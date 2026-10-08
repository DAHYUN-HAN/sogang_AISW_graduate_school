import assert from "node:assert/strict";
import test from "node:test";
import { dashboardDateError, dashboardMetricValue, dashboardPageRange, shiftDashboardDate, trafficBarHeights } from "../utils/adminDashboard";

test("dashboard dates reject impossible and future days against KST today", () => {
  const now = new Date("2026-10-07T15:00:00Z");
  assert.equal(dashboardDateError("2026-10-08", now), null);
  assert.match(dashboardDateError("2026-10-09", now) ?? "", /미래/);
  assert.match(dashboardDateError("2026-02-30", now) ?? "", /날짜/);
  assert.match(dashboardDateError("2026-2-3", now) ?? "", /날짜/);
  assert.match(dashboardDateError("", now) ?? "", /날짜/);
  assert.equal(shiftDashboardDate("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDashboardDate("2024-02-28", 1), "2024-02-29");
});

test("traffic bars keep uncollected dates distinct from collected zero", () => {
  assert.deepEqual(trafficBarHeights([null, 0, 5, 10]), [null, 0, 50, 100]);
  assert.deepEqual(trafficBarHeights([null, null]), [null, null]);
  assert.deepEqual(trafficBarHeights([0, 0]), [0, 0]);
  assert.equal(dashboardMetricValue(null, "회", "not_started"), "수집 시작 전");
  assert.equal(dashboardMetricValue(null, "회", "collecting"), "수집 시작 전");
  assert.equal(dashboardMetricValue(null, "회", "disabled"), "집계 불가");
  assert.equal(dashboardMetricValue(0, "회", "collecting"), "0회");
});

test("pagination describes actual rows and never invents an out-of-range row", () => {
  assert.equal(dashboardPageRange({ page: 1, size: 20, total: 43, items: new Array(20) }), "1–20 / 43건");
  assert.equal(dashboardPageRange({ page: 3, size: 20, total: 43, items: new Array(3) }), "41–43 / 43건");
  assert.equal(dashboardPageRange({ page: 4, size: 20, total: 43, items: [] }), "0 / 43건");
  assert.equal(dashboardPageRange({ page: 1, size: 20, total: 0, items: [] }), "0건");
});
