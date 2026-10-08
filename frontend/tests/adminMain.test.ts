import assert from "node:assert/strict";
import test from "node:test";
import * as main from "../utils/adminMain";
import * as usage from "../utils/usageTracking";

test("only administrator web routes escape the member frame", () => {
  assert.equal(main.useMemberWebFrame("web", 1440, "/admin", true), false);
  assert.equal(main.useMemberWebFrame("web", 1440, "/admin/migration-review", true), false);
  assert.equal(main.useMemberWebFrame("web", 1440, "/home", true), true);
  assert.equal(main.useMemberWebFrame("web", 1440, "/admin", false), true);
  assert.equal(main.useMemberWebFrame("ios", 1440, "/admin", true), false);
});

test("handled request dates use the review time instead of old receipt date", () => {
  assert.deepEqual(main.requestPresentation({ status: "completed", received_at: "2026-10-01T01:00:00Z", handled_at: "2026-10-07T02:05:00Z" }),
    { label: "완료", tone: "success", dateLabel: "처리", date: "2026-10-07T02:05:00Z" });
  assert.equal(main.requestPresentation({ status: "received", received_at: "2026-09-01T00:00:00Z", handled_at: null }).dateLabel, "접수");
});

test("uncollected traffic stays unavailable while a collected zero remains zero", () => {
  assert.equal(main.metricValue(null, "회", "not_started"), "수집 시작 전");
  assert.equal(main.metricValue(null, "회", "disabled"), "집계 불가");
  assert.equal(main.metricValue(0, "회", "collecting"), "0회");
});

test("next refresh follows Korean midnight independently of browser timezone", () => {
  assert.equal(main.millisecondsToKoreaMidnight(new Date("2026-10-07T14:59:59Z")), 1000);
  assert.equal(main.millisecondsToKoreaMidnight(new Date("2026-10-07T15:00:00Z")), 86400000);
});

test("cached handled records disappear at KST midnight even if refresh fails", () => {
  const pending = { status: "received", received_at: "2026-09-01T00:00:00Z", handled_at: null };
  const handled = { status: "answered", received_at: "2026-09-01T00:00:00Z", handled_at: "2026-10-07T14:00:00Z" };
  assert.equal(main.koreaDate(new Date("2026-10-07T15:00:00Z")), "2026-10-08");
  assert.deepEqual(main.currentMainRequests([pending, handled], "2026-10-07"), [pending, handled]);
  assert.deepEqual(main.currentMainRequests([pending, handled], "2026-10-08"), [pending]);
});

test("tracking ignores rerenders and admin or auth routes but counts new post navigation", () => {
  const tracker = usage.createNavigationTracker();
  assert.equal(tracker.visit("/home", 1, "user"), "home");
  assert.equal(tracker.visit("/home", 1, "user"), null);
  assert.equal(tracker.visit("/board/post/1", 1, "user"), "post");
  assert.equal(tracker.visit("/board/post/2", 1, "user"), "post");
  assert.equal(tracker.visit("/admin", 1, "user"), null);
  assert.equal(tracker.visit("/auth/login", null, null), null);
  assert.equal(tracker.visit("/home", 3, "admin"), null);
  assert.equal(tracker.visit("/home", 1, "user"), "home");
});

test("refocusing within the active session does not create another page view", () => {
  assert.equal(usage.shouldRecordUsageResume(1000, 11000), false);
  assert.equal(usage.shouldRecordUsageResume(1000, 1800999), false);
  assert.equal(usage.shouldRecordUsageResume(1000, 1801000), true);
});

test("opening cached request detail waits for the fresh response before accepting a draft", () => {
  assert.equal(main.canInitializeRequestDraft(true, true), false);
  assert.equal(main.canInitializeRequestDraft(false, false), false);
  assert.equal(main.canInitializeRequestDraft(true, false), true);
});
