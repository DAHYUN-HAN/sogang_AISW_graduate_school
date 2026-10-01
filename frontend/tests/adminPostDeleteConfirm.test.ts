import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ReactElement } from "react";
import ts from "typescript";

const componentPath = join(process.cwd(), "components", "admin", "AdminPostDeleteConfirm.tsx");
const nodeRequire = createRequire(import.meta.url);

function loadComponent() {
  const source = readFileSync(componentPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  const mockRequire = (id: string) => {
    if (id.endsWith("/AppTypography")) return { AppText: "Text", AppTextInput: "TextInput" };
    if (id === "react-native") {
      return {
        Modal: "Modal",
        Pressable: "Pressable",
        Text: "Text",
        View: "View",
      };
    }
    return nodeRequire(id);
  };
  new Function("module", "exports", "require", compiled)(module, module.exports, mockRequire);
  return module.exports.default as (props: {
    visible: boolean;
    deleting: boolean;
    error: string | null;
    onCancel: () => void;
    onConfirm: () => void;
  }) => ReactElement;
}

function renderedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join("");
  if (!value || typeof value !== "object") return "";
  return renderedText((value as { props?: { children?: unknown } }).props?.children);
}

test("관리자 게시글 삭제 확인은 웹에서도 보이는 화면 내 확인창으로 렌더링된다", () => {
  assert.equal(existsSync(componentPath), true);
  const AdminPostDeleteConfirm = loadComponent();
  const tree = AdminPostDeleteConfirm({
    visible: true,
    deleting: false,
    error: null,
    onCancel: () => undefined,
    onConfirm: () => undefined,
  });
  const modal = tree as ReactElement<{ visible: boolean }>;
  const text = renderedText(tree);

  assert.equal(modal.type, "Modal");
  assert.equal(modal.props.visible, true);
  assert.match(text, /게시물 삭제/);
  assert.match(text, /삭제한 게시물은 복구할 수 없어요/);
  assert.match(text, /취소/);
  assert.match(text, /삭제/);
});
