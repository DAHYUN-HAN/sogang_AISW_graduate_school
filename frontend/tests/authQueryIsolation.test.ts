import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import ts from "typescript";

test("changing accounts discards private edit data, signed media URLs and mounted form state", () => {
  const source = ts.createSourceFile("root.tsx", readFileSync("app/_layout.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "RootLayout");
  assert.ok(fn);
  const code = ts.transpileModule(`(${fn.getText(source).replace("export default ", "")})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "element" },
  }).outputText;
  let user: { id: number; role: string } | null = { id: 1, role: "user" };
  let cursor = 0;
  const slots: any[] = [];
  const root = runInNewContext(code, {
    QueryClient, QueryClientProvider: "QueryClientProvider", APP_FONTS: {}, styles: {},
    useState: (initial: any) => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial; return [slots[i], () => {}]; },
    useMemo: (factory: () => unknown, deps: unknown[]) => { const i = cursor++; if (!slots[i] || deps.some((value, n) => value !== slots[i].deps[n])) slots[i] = { deps, value: factory() }; return slots[i].value; },
    useEffect: () => {}, useWindowDimensions: () => ({ width: 1280 }), useFonts: () => [true],
    useUserStore: (selector: (state: unknown) => unknown) => selector({ user, isAuthenticated: Boolean(user), hasHydrated: true, hydrateSession: () => {} }),
    isAdminUser: (value: typeof user) => value?.role === "admin", Platform: { OS: "web" }, shouldShowSplash: () => false,
    View: "View", KeyboardViewport: "KeyboardViewport", StatusBar: "StatusBar", NotificationBootstrap: "NotificationBootstrap", StatusBarScrim: "StatusBarScrim",
    Stack: { Protected: "Protected", Screen: "Screen" }, element: (type: unknown, props: any, ...children: unknown[]) => ({ type, props, children }),
  });
  const render = () => { cursor = 0; return root(); };
  const owner = render();
  owner.props.client.setQueryData(["post", 12, "edit"], { proof_url: "private proof" });
  owner.props.client.setQueryData(["media-access", 6], "private signed URL");
  assert.equal(render().props.client, owner.props.client, "ordinary renders preserve this account's cache");
  user = null;
  const guest = render();
  assert.notEqual(guest.props.client, owner.props.client);
  assert.notEqual(guest.props.key, owner.props.key);
  user = { id: 2, role: "user" };
  const peer = render();
  assert.equal(peer.props.client.getQueryCache().getAll().length, 0);
  assert.notEqual(peer.props.key, owner.props.key);
  owner.props.client.clear(); guest.props.client.clear(); peer.props.client.clear();
});
