import type { EventItem } from "../types";
import { parseApiDate } from "./dateFormat";

const KOREA_TIME_ZONE = "Asia/Seoul";
const DAY_MS = 86_400_000;

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

const koreaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: KOREA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function partsFromDate(date: Date): CalendarDateParts {
  const values = Object.fromEntries(
    koreaDateFormatter
      .formatToParts(date)
      .filter((part) => part.type === "year" || part.type === "month" || part.type === "day")
      .map((part) => [part.type, Number(part.value)])
  );
  return { year: values.year, month: values.month, day: values.day };
}

function partsFromApiValue(value?: string | null): CalendarDateParts | null {
  if (!value) return null;
  const parsed = parseApiDate(value);
  return parsed ? partsFromDate(parsed) : null;
}

function ordinal(parts: CalendarDateParts) {
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_MS);
}

function eventOrdinals(event: Pick<EventItem, "start_at" | "end_at">) {
  const startParts = partsFromApiValue(event.start_at);
  if (!startParts) return null;
  const start = ordinal(startParts);
  const parsedEnd = partsFromApiValue(event.end_at);
  const end = parsedEnd ? Math.max(start, ordinal(parsedEnd)) : start;
  return { start, end };
}

export function koreaCalendarDate(now = new Date()): CalendarDateParts {
  return partsFromDate(now);
}

export function currentKoreaMonth(now = new Date()) {
  const current = koreaCalendarDate(now);
  return new Date(current.year, current.month - 1, 1);
}

export function calendarDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarMonthRange(month: Date) {
  return {
    start: calendarDateKey(new Date(month.getFullYear(), month.getMonth(), 1)),
    end: calendarDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0)),
  };
}

/**
 * 보고 있는 달의 앞뒤까지 한 번에 받아오는 범위.
 *
 * 달력은 이전 응답을 들고 있다가 새 달 응답이 오면 갈아끼운다(placeholderData).
 * 한 달치만 받으면 옆 달로 넘어간 직후 들고 있는 데이터에 그 달이 없어 날짜 점이
 * 잠깐 사라진다. 앞뒤 한 달을 더 받아두면 한 칸 이동은 항상 들고 있는 데이터
 * 안에 들어와서 점이 끊기지 않는다.
 */
export function calendarMonthWindowRange(month: Date, padMonths = 1) {
  return {
    start: calendarMonthRange(shiftCalendarMonth(month, -padMonths)).start,
    end: calendarMonthRange(shiftCalendarMonth(month, padMonths)).end,
  };
}

export function shiftCalendarMonth(month: Date, delta: number) {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export function eventOccursOnCalendarDate(
  event: Pick<EventItem, "start_at" | "end_at">,
  date: CalendarDateParts
) {
  const range = eventOrdinals(event);
  if (!range) return false;
  const target = ordinal(date);
  return range.start <= target && target <= range.end;
}

export function eventDaysForMonth(events: EventItem[], month: Date) {
  const monthStart = ordinal({ year: month.getFullYear(), month: month.getMonth() + 1, day: 1 });
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthEnd = monthStart + lastDay - 1;
  const days = new Set<number>();

  for (const event of events) {
    const range = eventOrdinals(event);
    if (!range) continue;
    const visibleStart = Math.max(range.start, monthStart);
    const visibleEnd = Math.min(range.end, monthEnd);
    for (let current = visibleStart; current <= visibleEnd; current += 1) {
      days.add(current - monthStart + 1);
    }
  }

  return days;
}

export function eventIsCurrentOrUpcoming(event: EventItem, now = new Date()) {
  const range = eventOrdinals(event);
  return Boolean(range && range.end >= ordinal(koreaCalendarDate(now)));
}
