import assert from "node:assert/strict";
import test from "node:test";
import { registerNetworkRetry, retryNetworkReads, useNetworkStatusStore } from "../stores/networkStatusStore";

test("중복 연결 실패를 하나의 상태로 합치고 조회 재시도 후 복구한다", async () => {
  useNetworkStatusStore.getState().markDisconnected();
  useNetworkStatusStore.getState().markDisconnected();
  let localLoads = 0;
  let queryLoads = 0;
  const unregister = registerNetworkRetry(async () => { localLoads++; });
  await retryNetworkReads(async () => {}, async () => { queryLoads++; });
  unregister();
  assert.equal(useNetworkStatusStore.getState().disconnected, false);
  assert.equal(localLoads, 1);
  assert.equal(queryLoads, 1);
});

test("연결 확인 실패 시 조회나 쓰기를 재전송하지 않고 오류를 유지한다", async () => {
  useNetworkStatusStore.getState().markDisconnected();
  let loads = 0;
  const unregister = registerNetworkRetry(() => { loads++; });
  await retryNetworkReads(async () => { throw new Error("offline"); }, async () => { loads++; });
  unregister();
  assert.equal(loads, 0);
  assert.equal(useNetworkStatusStore.getState().disconnected, true);
});

test("재시도 중 새 연결 실패가 발생하면 먼저 시작한 복구가 오류를 지우지 않는다", async () => {
  await retryNetworkReads(async () => {}, async () => { useNetworkStatusStore.getState().markDisconnected(); });
  assert.equal(useNetworkStatusStore.getState().disconnected, true);
});

test("떠난 화면의 재시도 콜백은 해제되고 HTTP 오류는 연결 복구를 막지 않는다", async () => {
  let oldScreenLoads = 0;
  const unregister = registerNetworkRetry(() => { oldScreenLoads++; });
  unregister();
  await retryNetworkReads(async () => {}, async () => { throw new Error("HTTP 500"); });
  assert.equal(oldScreenLoads, 0);
  assert.equal(useNetworkStatusStore.getState().disconnected, false);
});

test("인증 API와 공통 API 모두 연결 오류를 보고하고 HTTP 오류·취소는 보고하지 않는다", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const ts = (await import("typescript")).default;
  const { AxiosError, CanceledError } = await import("axios");
  const { isNetworkError } = await import("../utils/networkError");
  const source = ts.createSourceFile("api.ts", readFileSync("services/api.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const interceptor = source.statements.find(node => ts.isForOfStatement(node) && node.getText(source).includes("markDisconnected"))!;
  assert.ok(interceptor);
  const handlers: ((error: unknown) => Promise<never>)[] = [];
  const client = () => ({ interceptors: { response: { use: (_success: unknown, reject: (error: unknown) => Promise<never>) => handlers.push(reject) } } });
  runInNewContext(ts.transpileModule(interceptor.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    api: client(), publicApi: client(), isNetworkError, useNetworkStatusStore,
  });
  assert.equal(handlers.length, 2);
  for (const handler of handlers) {
    const revision = useNetworkStatusStore.getState().revision;
    const error = new AxiosError("offline", "ERR_NETWORK");
    await assert.rejects(handler(error), actual => actual === error);
    assert.equal(useNetworkStatusStore.getState().revision, revision + 1);
    const httpError = new AxiosError("server response", "ERR_BAD_RESPONSE", undefined, {}, { status: 500 } as any);
    await assert.rejects(handler(httpError));
    await assert.rejects(handler(new CanceledError()));
    assert.equal(useNetworkStatusStore.getState().revision, revision + 1);
  }
});
