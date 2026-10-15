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
  const { isNetworkError, isServerLoadError } = await import("../utils/networkError");
  const source = ts.createSourceFile("api.ts", readFileSync("services/api.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const interceptor = source.statements.find(node => ts.isForOfStatement(node) && node.getText(source).includes("markDisconnected"))!;
  assert.ok(interceptor);
  const handlers: ((error: unknown) => Promise<never>)[] = [];
  const client = () => ({ interceptors: { response: { use: (_success: unknown, reject: (error: unknown) => Promise<never>) => handlers.push(reject) } } });
  runInNewContext(ts.transpileModule(interceptor.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    api: client(), publicApi: client(), isNetworkError, isServerLoadError, useNetworkStatusStore,
  });
  assert.equal(handlers.length, 2);
  for (const handler of handlers) {
    const revision = useNetworkStatusStore.getState().revision;
    const error = new AxiosError("offline", "ERR_NETWORK");
    await assert.rejects(handler(error), actual => actual === error);
    assert.equal(useNetworkStatusStore.getState().revision, revision + 1);
    // 2026-10-12: 조회(GET)가 500번대로 실패하면 연결 오류가 아니라 LoadError 상태로 보고한다.
    useNetworkStatusStore.setState({ serverFailed: false });
    const httpError = new AxiosError("server response", "ERR_BAD_RESPONSE", { method: "get" } as any, {}, { status: 500 } as any);
    await assert.rejects(handler(httpError));
    assert.equal(useNetworkStatusStore.getState().serverFailed, true);
    assert.equal(useNetworkStatusStore.getState().revision, revision + 2);
    // 쓰기 실패·4xx·취소는 덮개를 띄우지 않는다(화면별 토스트·안내).
    await assert.rejects(handler(new AxiosError("write failed", "ERR_BAD_RESPONSE", { method: "post" } as any, {}, { status: 500 } as any)));
    await assert.rejects(handler(new AxiosError("not found", "ERR_BAD_RESPONSE", { method: "get" } as any, {}, { status: 404 } as any)));
    await assert.rejects(handler(new CanceledError()));
    // 2026-10-16: 실패를 자기 자리에서 보여 주는 요청(투표 참여자 시트)은 덮개를 켜지 않는다.
    await assert.rejects(handler(new AxiosError("offline", "ERR_NETWORK", { method: "get", skipAppErrorOverlay: true } as any)));
    await assert.rejects(handler(new AxiosError("server response", "ERR_BAD_RESPONSE", { method: "get", skipAppErrorOverlay: true } as any, {}, { status: 500 } as any)));
    assert.equal(useNetworkStatusStore.getState().revision, revision + 2);
  }
});

test("LoadError 재시도가 성공하면 서버 조회 실패 상태도 지운다", async () => {
  useNetworkStatusStore.getState().markServerFailed();
  await retryNetworkReads(async () => {}, async () => {});
  assert.equal(useNetworkStatusStore.getState().serverFailed, false);
});

test("화면 첫 조회 실패는 4xx도 LoadError로 보되 인터넷 끊김·401·취소는 뺀다", async () => {
  const { AxiosError, CanceledError } = await import("axios");
  const { isLoadFailure } = await import("../utils/networkError");
  const response = (status: number) => new AxiosError("bad", "ERR_BAD_REQUEST", { method: "get" } as any, {}, { status } as any);
  assert.equal(isLoadFailure(response(404)), true);
  assert.equal(isLoadFailure(response(403)), true);
  assert.equal(isLoadFailure(response(500)), true);
  assert.equal(isLoadFailure(new Error("board is missing")), true);
  assert.equal(isLoadFailure(response(401)), false);
  assert.equal(isLoadFailure(new AxiosError("offline", "ERR_NETWORK")), false);
  assert.equal(isLoadFailure(new CanceledError()), false);
  assert.equal(isLoadFailure(null), false);
});
