export type CalendarMonthView = {
  year: number;
  monthIndex: number;
};

export const MUTUAL_AID_MIN_LEAD_DAYS = 0;

const KOREA_TIME_ZONE = "Asia/Seoul";
const DOT_DATE_PATTERN = /^(\d{4})\.(\d{2})\.(\d{2})$/;

type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

function calendarDateParts(value?: string): CalendarDateParts | undefined {
  const match = DOT_DATE_PATTERN.exec(value ?? "");
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return undefined;
  }
  return { year, month, day };
}

function formatCalendarDateParts({ year, month, day }: CalendarDateParts): string {
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

function koreaCalendarDateParts(now: Date): CalendarDateParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: "year" | "month" | "day") =>
    Number(parts.find((part) => part.type === type)?.value);

  return { year: value("year"), month: value("month"), day: value("day") };
}

function addCalendarDays(parts: CalendarDateParts, days: number): CalendarDateParts {
  const result = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

export function formatDotDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

export function calendarMonthFromDotDate(value?: string, fallback = new Date()): CalendarMonthView {
  const parsed = calendarDateParts(value);
  if (parsed) return { year: parsed.year, monthIndex: parsed.month - 1 };

  return { year: fallback.getFullYear(), monthIndex: fallback.getMonth() };
}

export function minimumMutualAidEventDate(now = new Date()): string {
  return formatCalendarDateParts(addCalendarDays(koreaCalendarDateParts(now), MUTUAL_AID_MIN_LEAD_DAYS));
}

export function maximumActivityCertificationDate(now = new Date()): string {
  return formatCalendarDateParts(koreaCalendarDateParts(now));
}

export function isCalendarDateWithinBounds(
  value: string,
  bounds: { minimumDate?: string; maximumDate?: string },
): boolean {
  const parsed = calendarDateParts(value);
  if (!parsed) return false;

  const normalized = formatCalendarDateParts(parsed);
  if (bounds.minimumDate && normalized < bounds.minimumDate) return false;
  if (bounds.maximumDate && normalized > bounds.maximumDate) return false;
  return true;
}

export function isCalendarMonthAfterMaximum(
  year: number,
  monthIndex: number,
  maximumDate?: string,
): boolean {
  const maximum = calendarDateParts(maximumDate);
  if (!maximum) return false;
  return year > maximum.year || (year === maximum.year && monthIndex > maximum.month - 1);
}

export function isMutualAidEventDateAllowed(value?: string, now = new Date()): boolean {
  const parsed = calendarDateParts(value);
  if (!parsed) return false;
  return formatCalendarDateParts(parsed) >= minimumMutualAidEventDate(now);
}
