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
    assert.match(source, /<BackIcon size=\{22\}/, screen);
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
  assert.match(codeInput, /borderWidth: 1/);
  assert.match(codeInput, /paddingHorizontal: 16/);
  assert.match(codeInput, /lineHeight: 22/);

  const actionText = styleBlock(source, "primaryButtonText");
  assert.match(actionText, /fontSize: 16/);
  assert.match(actionText, /lineHeight: 24/);
  assert.match(source, /VERIFICATION_ATTEMPTS_EXCEEDED_MESSAGE/);
});

test("login and password reset keep the Figma primary action type scale", () => {
  const loginAction = styleBlock(readSource("app/auth/login.tsx"), "primaryButtonText");
  assert.match(loginAction, /fontSize: 16/);
  assert.match(loginAction, /lineHeight: 24/);

  // 비밀번호 찾기 최신 Figma: 인증코드 받기 버튼은 14/24.
  const resetAction = styleBlock(readSource("app/auth/password-reset.tsx"), "primaryButtonText");
  assert.match(resetAction, /fontSize: 14/);
  assert.match(resetAction, /lineHeight: 24/);
});

test("auth controls do not add the browser default black focus outline", () => {
  for (const screen of ["app/auth/login.tsx", "app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = readSource(screen);
    assert.match(styleBlock(source, "primaryButton"), /outlineStyle: "none"/, screen);
  }

  for (const screen of ["app/auth/register.tsx", "app/auth/password-reset.tsx"]) {
    const source = readSource(screen);
    assert.match(styleBlock(source, "input"), /outlineStyle: "none"/, screen);
  }

  assert.match(styleBlock(readSource("app/auth/register.tsx"), "codeInput"), /outlineStyle: "none"/);
});
