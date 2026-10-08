import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { AxiosError, CanceledError } from "axios";
import ts from "typescript";
import { isNetworkError } from "../utils/networkError";

const disconnected = new AxiosError("Network Error", "ERR_NETWORK");

test("연결 실패와 시간 초과만 네트워크 오류로 표시한다", () => {
  assert.equal(isNetworkError(disconnected), true);
  assert.equal(isNetworkError(new AxiosError("timeout", "ECONNABORTED")), true);
  assert.equal(isNetworkError(new AxiosError("timeout", "ETIMEDOUT")), true);
  assert.equal(isNetworkError(new AxiosError("connection failed", undefined, undefined, {})), true);
  assert.equal(isNetworkError(undefined), false);
  assert.equal(isNetworkError(new Error("render failed")), false);
});

test("서버 응답 오류와 취소된 요청은 기존 안내를 유지한다", () => {
  for (const status of [401, 403, 404, 422, 500]) {
    const response = { status, data: {}, statusText: "Error", headers: {}, config: {} };
    assert.equal(isNetworkError(new AxiosError("response failed", "ERR_BAD_RESPONSE", undefined, {}, response as any)), false);
  }
  assert.equal(isNetworkError(new CanceledError()), false);
});

test("네트워크 오류 UI의 재시도 버튼은 전달된 화면 재요청을 실행한다", () => {
  type Element = { type: unknown; props: Record<string, any>; children: any[] };
  const exported: Record<string, any> = {};
  const code = ts.transpileModule(readFileSync("components/NetworkErrorState.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  runInNewContext(code, {
    exports: exported,
    React: { Fragment: "Fragment", createElement: (type: unknown, props: unknown, ...children: unknown[]) => ({ type, props: props ?? {}, children }) },
    require: (name: string) => {
      if (name === "react") return { useEffect() {} };
      if (name === "@react-navigation/native") return { useIsFocused: () => true };
      if (name === "../stores/networkStatusStore") return { registerNetworkRetry: () => () => {} };
      if (name === "react-native") return { View: "View", Pressable: "Pressable", StyleSheet: { create: (styles: unknown) => styles } };
      if (name === "react-native-svg") return { default: "Svg", Path: "Path" };
      if (name === "./AppTypography") return { AppText: "Text" };
      if (name === "../utils/networkError") return { isNetworkError };
      throw new Error(name);
    },
  });
  let retries = 0;
  const onRetry = () => retries++;
  const tree = exported.default({ onRetry }) as Element;
  const button = tree.children.find((node: Element) => node.type === "Pressable")!;
  assert.equal(button.props.accessibilityLabel, "다시 시도");
  button.props.onPress();
  assert.equal(retries, 1);
  assert.ok(tree.children.some((node: Element) => node.children.includes("네트워크 연결이 원활하지 않아요")));
  assert.ok(tree.children.some((node: Element) => node.children.includes("인터넷 연결 상태를 확인한 후 다시 시도해주세요")));
  const fallback = { type: "server-error" };
  assert.equal(exported.NetworkErrorFallback({ error: disconnected, onRetry, children: fallback }).type, exported.default);
  assert.equal(exported.NetworkErrorFallback({ error: undefined, onRetry, children: fallback }).children[0], fallback);
});
