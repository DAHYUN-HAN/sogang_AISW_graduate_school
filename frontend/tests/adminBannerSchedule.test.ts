import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createElement, isValidElement } from "react";
import { utcApiDateTimeToKoreaInput, koreaDateTimeInputToUtcISOString } from "../utils/dateFormat";

function load(file: string, name: string, context: Record<string, unknown>) {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node;
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found);
  const expression = ts.isFunctionDeclaration(found) ? found.getText(source).replace(/^export(?: default)? /, "") + `; ${name}` : `(${found.getText(source)})`;
  return runInNewContext(ts.transpileModule(expression, { compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React } }).outputText, context);
}

test("editing a banner displays UTC API dates as Korean calendar and clock values", () => {
  const formFromItem = load("components/admin/AdminControls.tsx", "bannerFormFromItem", { utcApiDateTimeToKoreaInput });
  const form = formFromItem({ id: 1, theme: "none", starts_at: "2026-10-07T09:00:00", ends_at: "2026-10-08T15:15:00Z", cta_href: "/board/post/15", image_url: "/uploads/banner.png", is_active: true });
  assert.equal(form.starts_at, "2026-10-07T18:00");
  assert.equal(form.ends_at, "2026-10-09T00:15");
  assert.equal(form.cta_href, "/board/post/15");
  assert.equal(form.mobile_image_url, "/uploads/banner.png");
});

function save(starts: string, ends: string) {
  const writes: Record<string, unknown>[] = [];
  const messages: { tone: string; text: string }[] = [];
  const form = { mobile_image_url: "/uploads/banner.png", tablet_image_url: "", desktop_image_url: "", starts_at: starts, ends_at: ends, cta_href: "/board/post/15", sort_order: "3", is_active: true };
  const callback = load("components/admin/useAdminController.tsx", "handleSaveBanner", {
    bannerSaving: false, bannerForm: form, editingBannerId: null, selectedBannerPosition: null, nextBannerPosition: 1,
    cleanOptional: (value: string) => value.trim() || undefined, cleanNullable: (value: string) => value.trim() || null,
    parseSort: (value: string) => Number(value), koreaDateTimeInputToUtcISOString,
    bannerFormFromItem: (value: unknown) => value,
    bannerApi: { createBanner: async (payload: Record<string, unknown>) => { writes.push(payload); return { data: { id: 1, ...payload } }; } },
    setBannerSaveMessage: (message: { tone: string; text: string }) => messages.push(message),
    setBannerSaving: () => {}, setEditingBannerId: () => {}, setBannerForm: () => {},
    queryClient: { invalidateQueries: () => Promise.resolve() }, Alert: { alert: () => {} },
  });
  return { run: callback as () => Promise<void>, writes, messages };
}

test("banner save sends Korean schedule as UTC while keeping the chosen post and images", async () => {
  const action = save("2026-10-07T18:00", "2026-10-09T00:15");
  await action.run();
  assert.equal(action.writes.length, 1);
  assert.equal(action.writes[0].starts_at, "2026-10-07T09:00:00.000Z");
  assert.equal(action.writes[0].ends_at, "2026-10-08T15:15:00.000Z");
  assert.equal(action.writes[0].cta_href, "/board/post/15");
  assert.equal(action.writes[0].image_url, "/uploads/banner.png");
});

test("an invalid or reversed banner period never reaches the save API", async () => {
  for (const [start, end] of [["2026-02-30T12:00", ""], ["2026-10-08T09:00", "2026-10-07T18:00"], ["2026-10-07T18:00", "2026-10-07T18:00"]]) {
    const action = save(start, end);
    await action.run();
    assert.equal(action.writes.length, 0);
    assert.equal(action.messages.at(-1)?.tone, "error");
  }
});

test("unscheduled banners and one-sided periods retain their existing optional bounds", async () => {
  for (const [start, end, expectedStart, expectedEnd] of [["", "", null, null], ["2026-10-07T18:00", "", "2026-10-07T09:00:00.000Z", null], ["", "2026-10-09T00:15", null, "2026-10-08T15:15:00.000Z"]]) {
    const action = save(start as string, end as string);
    await action.run();
    assert.equal(action.writes[0].starts_at, expectedStart);
    assert.equal(action.writes[0].ends_at, expectedEnd);
  }
});

test("disabled schedule blocks keyboard inputs and clearing the deadline", () => {
  const writes: string[] = [];
  const component = load("components/admin/AdminBannerSchedule.tsx", "AdminBannerSchedule", {
    React: {createElement}, createElement, Platform: {OS: "web"}, View: "View", Text: "Text", ActionButton: "Button",
    styles: {}, inputStyle: {},
  });
  const nodes: any[] = [];
  const walk = (node: any) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!isValidElement(node)) return;
    nodes.push(node); walk((node.props as any).children);
  };
  walk(component({label: "투표 마감", value: "2026-10-14T18:00", fallbackTime: "18:00", disabled: true,
    onChange: (value: string) => writes.push(value)}));
  const controls = nodes.filter(n => n.type === "input" || n.type === "Button");
  assert.equal(controls.length, 3);
  for (const control of controls) {
    assert.equal(control.props.disabled, true);
    if (control.props.onChange) control.props.onChange({target: {value: "2026-11-14"}});
    if (control.props.onPress) control.props.onPress();
  }
  assert.deepEqual(writes, []);
});
