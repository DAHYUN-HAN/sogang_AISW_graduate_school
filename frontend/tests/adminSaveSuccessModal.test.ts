import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { ReactElement } from "react";
import ts from "typescript";

const componentPath = join(process.cwd(), "components", "admin", "AdminSaveSuccessModal.tsx");
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
    title: string;
    message: string;
    onConfirm: () => void;
  }) => ReactElement;
}

function renderedText(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(renderedText).join("");
  if (!value || typeof value !== "object") return "";
  return renderedText((value as { props?: { children?: unknown } }).props?.children);
}

test("공지 등록 성공은 웹에서도 동일한 디자인 모달로 표시한다", () => {
  assert.equal(existsSync(componentPath), true);
  const AdminSaveSuccessModal = loadComponent();
  const tree = AdminSaveSuccessModal({
    visible: true,
    title: "등록 완료",
    message: "공지사항이 등록되었습니다.",
    onConfirm: () => undefined,
  });
  const modal = tree as ReactElement<{ visible: boolean }>;
  const text = renderedText(tree);

  assert.equal(modal.type, "Modal");
  assert.equal(modal.props.visible, true);
  assert.match(text, /등록 완료/);
  assert.match(text, /공지사항이 등록되었습니다/);
  assert.match(text, /확인/);
});
