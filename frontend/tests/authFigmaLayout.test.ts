import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const frontendRoot = path.resolve(import.meta.dirname, "..");

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(frontendRoot, relativePath), "utf8");
}

function styleBlock(source: string, styleName: string) {
  const match = source.match(new RegExp(`(?:^|\\n)  ${styleName}: \\{([\\s\\S]*?)\\},[^\\r\\n]*\\r?\\n`, "m"));
  assert.ok(match, `${styleName} style should exist`);
  return match[1];
}

test("auth headers retain the Figma 360px geometry", () => {
  for (const screen of ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = readSource(screen);
    const appBar = styleBlock(source, "appBar");
    const iconButton = styleBlock(source, "iconButton");
    const appBarTitle = styleBlock(source, "appBarTitle");

    assert.match(source, /paddingTop: Math\.max\(insets\.top, 18\)/, screen);
    // 로그인은 게스트가 처음 닿는 화면이라 돌아갈 곳이 없다. Figma TopBar(194:22)도
    // 아이콘 없는 22x22 자리다. 나머지 두 화면은 로그인에서 밀려 들어오므로 뒤로가 있다.
    if (screen === "app/auth/login.tsx") assert.doesNotMatch(source, /<BackIcon/, screen);
    else assert.match(source, /<BackIcon size=\{22\}/, screen);
    assert.match(appBar, /minHeight: 56/);
    assert.match(appBar, /paddingHorizontal: 16/);
    assert.match(appBar, /paddingBottom: 12/);
    assert.match(iconButton, /width: 22/);
    assert.match(iconButton, /height: 22/);
    assert.match(appBarTitle, /lineHeight: 26/);
  }
});

test("signup typography, code input, steps, and action match the Figma signup frames", () => {
  const source = readSource("app/auth/register.tsx");

  assert.match(styleBlock(source, "content"), /paddingTop: 24/);
  assert.match(styleBlock(source, "stepDots"), /gap: 6/);
  assert.doesNotMatch(styleBlock(source, "stepDots"), /paddingBottom/);
  assert.match(styleBlock(source, "stepDot"), /#DDE2EA/);
  assert.match(styleBlock(source, "heading"), /fontSize: 20/);
  assert.match(styleBlock(source, "heading"), /lineHeight: 28/);
  assert.match(styleBlock(source, "helper"), /fontSize: 13/);
  assert.match(styleBlock(source, "helper"), /lineHeight: 18/);

  const codeInput = styleBlock(source, "codeInput");
  assert.match(codeInput, /height: 48/);
  // 테두리는 입력 칸 공통 원칙(FieldBorder)이 그린다.
  assert.doesNotMatch(codeInput, /borderWidth/);
  assert.match(codeInput, /paddingHorizontal: 16/);
  assert.match(codeInput, /lineHeight: 22/);

  const actionText = styleBlock(source, "primaryButtonText");
  assert.match(actionText, /\.\.\.BUTTON_TEXT/);
  assert.doesNotMatch(actionText, /lineHeight/);
  assert.match(source, /VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE/);
});

test("login and password reset keep the Figma primary action type scale", () => {
  // 2026-10-15 피그마: 버튼 글자는 모두 16px, 줄 높이는 공통 19(utils/buttonText.ts).
  assert.match(readSource("utils/buttonText.ts"), /fontSize: 16,/);
  const loginAction = styleBlock(readSource("app/auth/login.tsx"), "primaryButtonText");
  assert.match(loginAction, /\.\.\.BUTTON_TEXT/);
  assert.doesNotMatch(loginAction, /lineHeight/);

  const resetAction = styleBlock(readSource("app/auth/password-reset.tsx"), "primaryButtonText");
  assert.match(resetAction, /\.\.\.BUTTON_TEXT/);
  assert.doesNotMatch(resetAction, /lineHeight/);
});

test("auth controls do not add the browser default black focus outline", () => {
  for (const screen of ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = readSource(screen);
    assert.match(styleBlock(source, "primaryButton"), /outlineStyle: "none"/, screen);
  }

  // 입력 칸은 FieldInput이 브라우저 기본 테두리를 끈다.
  assert.match(readSource("components/FieldBorder.tsx"), /outlineStyle: "none"/);
  for (const screen of ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = readSource(screen);
    assert.match(source, /<FieldInput/, screen);
    assert.doesNotMatch(source, /<TextInput/, screen);
  }
});
