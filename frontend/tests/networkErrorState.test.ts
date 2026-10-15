import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { AxiosError, CanceledError } from "axios";
import ts from "typescript";
import { isNetworkError, isServerLoadError } from "../utils/networkError";

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
      if (name === "react-native-svg") return { default: "Svg", Path: "Path", Circle: "Circle", Rect: "Rect" };
      if (name === "./AppTypography") return { AppText: "Text" };
      if (name === "../utils/networkError") return { isNetworkError, isServerLoadError };
      if (name === "../utils/buttonText") return { BUTTON_TEXT: { fontSize: 16, lineHeight: 19 } };
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

// 2026-10-12 피그마 Screen/Common/LoadError: 서버가 조회에 실패하면 앱 전체를 이 화면으로 덮는다.
test("서버 조회 실패만 LoadError 대상으로 판별한다", () => {
  const response = (status: number) => ({ status, data: {}, statusText: "Error", headers: {}, config: {} }) as any;
  assert.equal(isServerLoadError(new AxiosError("x", "ERR_BAD_RESPONSE", { method: "get" } as any, {}, response(500))), true);
  assert.equal(isServerLoadError(new AxiosError("x", "ERR_BAD_RESPONSE", { method: "get" } as any, {}, response(503))), true);
  assert.equal(isServerLoadError(new AxiosError("x", "ERR_BAD_RESPONSE", { method: "post" } as any, {}, response(500))), false);
  assert.equal(isServerLoadError(new AxiosError("x", "ERR_BAD_RESPONSE", { method: "get" } as any, {}, response(404))), false);
  assert.equal(isServerLoadError(disconnected), false);
});

test("LoadError 화면은 피그마 문구를 쓰고 앱 덮개가 서버 실패 때 띄운다", () => {
  const state = readFileSync("components/NetworkErrorState.tsx", "utf8");
  assert.match(state, /페이지를 불러오지 못했어요/);
  assert.match(state, /잠시 후 다시 시도해주세요/);
  const overlay = readFileSync("components/AppNetworkError.tsx", "utf8");
  assert.match(overlay, /if \(!disconnected && !serverFailed\) return null;/);
  assert.match(overlay, /: <LoadErrorState onRetry=/);
});
