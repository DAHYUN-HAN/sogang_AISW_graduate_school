import assert from "node:assert/strict";
import { createRequire, registerHooks } from "node:module";
import test from "node:test";
import React, { createElement } from "react";
import type { ReactNode } from "react";

const vectorIconsStub = new URL("./fixtures/vectorIconsStub.ts", import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "react-native") return nextResolve("react-native-web", context);
    if (specifier === "@expo/vector-icons") return nextResolve(vectorIconsStub, context);
    if (specifier === "expo-document-picker") return nextResolve("node:fs", context);
    return nextResolve(specifier, context);
  },
});
(globalThis as typeof globalThis & { __DEV__: boolean }).__DEV__ = true;
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const editorModule = import("../components/admin/DuesPaymentEditor");
const { renderToString } = createRequire(import.meta.url)("react-dom/server") as {
  renderToString: (element: ReactNode) => string;
};

test("개별 행사 편집기는 첫 렌더부터 새 게시판 선택을 요구한다", async () => {
  const module = await editorModule as typeof import("../components/admin/DuesPaymentEditor") & {
    DuesPaymentEditorContent?: (props: Record<string, unknown>) => ReactNode;
  };
  assert.equal(typeof module.DuesPaymentEditorContent, "function");
  const html = renderToString(createElement(module.DuesPaymentEditorContent!, {
    mode: "REGISTER_ONCE",
    item: {
      id: 3,
      name: "QA검증원우",
      major: "소프트웨어",
      student_number: "A99003",
      payment_scope: "ONCE",
      once_board_id: 17,
      once_board_name: "이전 행사",
    },
    activityBoards: [{
      id: 23,
      name: "네트워킹 활동 인증",
      slug: "networking-activity",
      category: "participation",
      board_type: "activity_certification",
      sort_order: 1,
      allow_anonymous: false,
      read_permission: "guest",
      write_permission: "user",
      is_active: true,
    }],
    saving: false,
    onClose: () => {},
    onSave: () => {},
  }));

  assert.match(html, /활동인증 게시판 선택/);
  assert.match(html, /네트워킹 활동 인증/);
  assert.match(html, /aria-disabled="true"/);
  assert.doesNotMatch(html, /전체 납부/);
});
