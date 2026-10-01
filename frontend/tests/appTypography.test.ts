import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import React, { type ComponentType, type ReactNode } from "react";
import ts from "typescript";

const nodeRequire = createRequire(import.meta.url);
const web = nodeRequire("react-native-web");
const { renderToStaticMarkup } = nodeRequire("react-dom/server") as {
  renderToStaticMarkup: (element: ReactNode) => string;
};
type Props = Record<string, any>;

function typographyHarness(platform: "android" | "ios" | "web") {
  const calls: { kind: "text" | "input"; props: Props }[] = [];
  // Native host components cannot mount in Node. Keep React and style resolution
  // real, recording the props passed across the native boundary instead.
  const native = {
    StyleSheet: web.StyleSheet,
    Text(props: Props) {
      calls.push({ kind: "text", props });
      return React.createElement("span", null, props.children);
    },
    TextInput(props: Props) {
      calls.push({ kind: "input", props });
      return React.createElement("input");
    },
  };
  const rn = platform === "web" ? web : native;
  const cache = new Map<string, { exports: any }>();
  function load(file: string): any {
    if (cache.has(file)) return cache.get(file)!.exports;
    const module = { exports: {} as any };
    cache.set(file, module);
    const code = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
      },
    }).outputText;
    const requireModule = (id: string): any => {
      if (id === "react-native") return rn;
      if (id.endsWith(".otf")) return 1;
      if (id.startsWith(".")) {
        const target = resolve(dirname(file), id);
        return load(existsSync(`${target}.tsx`) ? `${target}.tsx` : `${target}.ts`);
      }
      return nodeRequire(id);
    };
    new Function("module", "exports", "require", code)(module, module.exports, requireModule);
    return module.exports;
  }
  const componentPath = resolve("components/AppTypography.tsx");
  const components = load(componentPath) as { AppText: ComponentType<any>; AppTextInput: ComponentType<any> };
  return { ...components, calls, render: renderToStaticMarkup, StyleSheet: rn.StyleSheet };
}

for (const platform of ["android", "ios"] as const) {
  test(`${platform}: app text selects the requested static face before reaching the native host`, () => {
    const h = typographyHarness(platform);
    const cases = [
      [undefined, "Pretendard_400Regular"], ["normal", "Pretendard_400Regular"],
      ["300", "Pretendard_400Regular"], ["400", "Pretendard_400Regular"],
      ["500", "Pretendard_500Medium"], ["600", "Pretendard_600SemiBold"],
      ["700", "Pretendard_700Bold"], ["bold", "Pretendard_700Bold"],
      ["800", "Pretendard_800ExtraBold"], ["900", "Pretendard_900Black"],
    ];
    for (const [weight, family] of cases) {
      h.render(React.createElement(h.AppText, { style: { fontWeight: weight, fontSize: 18 } }, "한글 ABC 123"));
      const style = h.StyleSheet.flatten(h.calls.at(-1)!.props.style);
      assert.equal(style.fontFamily, family);
      assert.equal(style.fontWeight, "normal");
      assert.equal(style.fontSize, 18);
    }
  });

  test(`${platform}: nested text inherits its parent's face and can override the weight`, () => {
    const h = typographyHarness(platform);
    h.render(React.createElement(h.AppText, { style: { fontWeight: "700" } },
      React.createElement(h.AppText, { style: { color: "red" } }, "inherit"),
      React.createElement(h.AppText, { style: { fontWeight: "400" } }, "override")));
    assert.deepEqual(h.calls.map(({ props }) => h.StyleSheet.flatten(props.style).fontFamily),
      ["Pretendard_700Bold", "Pretendard_700Bold", "Pretendard_400Regular"]);
  });

  test(`${platform}: input style arrays preserve props, refs and the selected font without mutating caller styles`, () => {
    const h = typographyHarness(platform);
    const ref = React.createRef();
    const onChangeText = () => {};
    const base = Object.freeze({ fontWeight: "400", color: "blue" });
    const override = Object.freeze({ fontWeight: "600", fontSize: 14 });
    h.render(React.createElement(h.AppTextInput, {
      ref, value: "입력 ABC 123", onChangeText, secureTextEntry: true,
      multiline: true, accessibilityLabel: "폰트 입력", style: [base, false, override],
    }));
    const props = h.calls.at(-1)!.props;
    const style = h.StyleSheet.flatten(props.style);
    assert.equal(style.fontFamily, "Pretendard_600SemiBold");
    assert.equal(style.fontWeight, "normal");
    assert.equal(style.color, "blue");
    assert.equal(props.ref, ref);
    assert.equal(props.onChangeText, onChangeText);
    assert.equal(props.value, "입력 ABC 123");
    assert.equal(props.secureTextEntry, true);
    assert.equal(props.multiline, true);
    assert.equal(props.accessibilityLabel, "폰트 입력");
    assert.equal(base.fontWeight, "400");
    assert.equal(override.fontWeight, "600");
  });

  test(`${platform}: explicit custom font families and nested weights remain usable`, () => {
    const h = typographyHarness(platform);
    h.render(React.createElement(h.AppText, { style: { fontFamily: "CustomFont", fontWeight: "700" } },
      React.createElement(h.AppText, { style: { fontWeight: "400" } }, "custom")));
    assert.equal(h.calls[0].props.style.fontFamily, "CustomFont");
    assert.equal(h.calls[0].props.style.fontWeight, "700");
    assert.equal(h.calls[1].props.style.fontFamily, "CustomFont");
    assert.equal(h.calls[1].props.style.fontWeight, "400");
  });
}

test("web: real React Native Web text and inputs render matching faces without synthetic bold", () => {
  const h = typographyHarness("web");
  const text = h.render(React.createElement(h.AppText, { style: [{ fontWeight: "400" }, { fontWeight: "700" }] }, "한글 ABC 123"));
  assert.match(text, /font-family:Pretendard_700Bold/);
  assert.match(text, /font-weight:(?:normal|400)/);
  assert.doesNotMatch(text, /font-weight:700/);
  const input = h.render(React.createElement(h.AppTextInput, { style: { fontWeight: "500" }, value: "입력 ABC 123", onChangeText: () => {} }));
  assert.match(input, /font-family:Pretendard_500Medium/);
  assert.match(input, /font-weight:(?:normal|400)/);
  assert.match(input, /value="입력 ABC 123"/);
});

test("web: smoothing is installed once and native execution needs no document", () => {
  const code = ts.transpileModule(readFileSync("utils/fonts.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const appended: { id: string; textContent: string }[] = [];
  const exports = {} as { applyWebFontSmoothing: () => void };
  runInNewContext(code, {
    exports,
    document: {
      getElementById: (id: string) => appended.find((element) => element.id === id),
      createElement: () => ({ id: "", textContent: "" }),
      head: { appendChild: (element: typeof appended[number]) => appended.push(element) },
    },
  });
  exports.applyWebFontSmoothing();
  exports.applyWebFontSmoothing();
  assert.equal(appended.length, 1);
  assert.match(appended[0].textContent, /-webkit-font-smoothing:antialiased/);
  assert.match(appended[0].textContent, /-moz-osx-font-smoothing:grayscale/);
  const nativeExports = {} as typeof exports;
  runInNewContext(code, { exports: nativeExports });
  assert.doesNotThrow(() => nativeExports.applyWebFontSmoothing());
});
