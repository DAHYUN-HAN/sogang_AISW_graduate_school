import assert from "node:assert/strict";
import test from "node:test";
import { adminDestination } from "../utils/adminNavigation";
import { postCreateCompletionRoute, postDetailBackDecision } from "../utils/appRoutes";
import * as navigation from "../utils/adminNavigation";

test("administrator post navigation retains query parameters and stays in the workspace", () => {
  assert.equal(adminDestination("/board/post/12?fromBoardId=3"), "/admin/boards/post/12?fromBoardId=3");
  assert.equal(adminDestination("/board/post/edit/12"), "/admin/boards/post/12/edit");
  assert.deepEqual(adminDestination({ pathname: "/board/post/create", params: { boardId: "3", postId: "12" } }), { pathname: "/admin/boards/create", params: { boardId: "3", postId: "12" } });
  assert.equal(adminDestination("/board/3"), "/admin/boards");
  assert.equal(adminDestination("/auth/login"), "/auth/login");
});

test("each existing administrator tab has a distinct canonical page", () => {
  const keys = ["main", "dashboard", "banners", "boardManagement", "accounts", "studentRoster", "duesPayments", "reports", "registration", "audit", "migration"] as const;
  const paths = keys.map((key) => navigation.adminSectionPath(key));
  assert.equal(new Set(paths).size, 11);
  keys.forEach((key, index) => assert.equal(navigation.adminSectionFromPath(paths[index]), key));
  assert.equal(navigation.adminSectionFromPath("/admin/boards/post/1/edit"), "boardManagement");
});

test("old section aliases retain their current administration destinations", () => {
  assert.equal(navigation.resolveAdminSection("/admin", "accounts", "web"), "accounts");
  assert.equal(navigation.resolveAdminSection("/admin", "events", "web"), "boardManagement");
  assert.equal(navigation.resolveAdminSection("/admin", undefined, "web"), "main");
  assert.equal(navigation.resolveAdminSection("/admin", undefined, "ios"), "dashboard");
  assert.equal(navigation.resolveAdminSection("/admin/banners", "accounts", "web"), "banners");
});

test("admin editor destinations keep generic post operations inside the console", () => {
  assert.equal(navigation.adminPostPath("detail", 12), "/admin/boards/post/12");
  assert.equal(navigation.adminPostPath("edit", 12), "/admin/boards/post/12/edit");
  assert.equal(navigation.adminPostPath("create", 3), "/admin/boards/create?boardId=3");
});

test("activity completion and refreshed detail fallback return to administrator boards", () => {
  const created = postCreateCompletionRoute("activity_certification", 12, 3);
  assert.equal(adminDestination(created), "/admin/boards/post/12?fromBoardId=3&returnTo=%2F(tabs)%2Fparticipation");
  const withReturn = postDetailBackDecision({ slug: "activity", category: "participation", board_type: "activity_certification" }, false, 3, "/(tabs)/participation");
  assert.equal(adminDestination(withReturn.action === "back" ? "/board" : withReturn.route), "/admin/boards");
  const refreshed = postDetailBackDecision({ slug: "notice", category: "notices", board_type: "notice" }, false);
  assert.equal(adminDestination(refreshed.action === "back" ? "/board" : refreshed.route), "/admin/boards");
});
