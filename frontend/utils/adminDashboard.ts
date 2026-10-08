import { koreaDate } from "./adminMain";

export function dashboardDateError(value: string, now = new Date()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "조회할 날짜를 선택해 주세요.";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value || Number(value.slice(0, 4)) < 1000) {
    return "올바른 날짜를 선택해 주세요.";
  }
  return value > koreaDate(now) ? "미래 날짜는 조회할 수 없습니다." : null;
}

export function shiftDashboardDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dashboardMetricValue(value: number | null, unit: string, status: string) {
  if (value === null) return status === "disabled" ? "집계 불가" : "수집 시작 전";
  return `${value.toLocaleString("ko-KR")}${unit}`;
}

export function trafficBarHeights(values: (number | null)[]) {
  const maximum = Math.max(0, ...values.filter((value): value is number => value !== null));
  return values.map((value) => value === null ? null : maximum === 0 ? 0 : value / maximum * 100);
}

export function dashboardPageRange(page: { page: number; size: number; total: number; items: readonly unknown[] }) {
  if (page.total === 0) return "0건";
  if (page.items.length === 0) return `0 / ${page.total.toLocaleString("ko-KR")}건`;
  const start = (page.page - 1) * page.size + 1;
  return `${start.toLocaleString("ko-KR")}–${Math.min(start + page.items.length - 1, page.total).toLocaleString("ko-KR")} / ${page.total.toLocaleString("ko-KR")}건`;
}
