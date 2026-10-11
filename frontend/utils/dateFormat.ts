const KST_OFFSET_HOURS = 9;
const KST_OFFSET_MS = KST_OFFSET_HOURS * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

type CalendarParts = {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hours: number;
  minutes: number;
};

function validCalendarParts(year: number, month: number, day: number): CalendarParts | null {
  const candidate = new Date(Date.UTC(year, month - 1, day));
  if (
    candidate.getUTCFullYear() !== year ||
    candidate.getUTCMonth() !== month - 1 ||
    candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return {
    year,
    month,
    day,
    weekday: WEEKDAYS[candidate.getUTCDay()],
    hours: 0,
    minutes: 0,
  };
}

function calendarValueParts(value: string): CalendarParts | null {
  const match = /^(\d{2}|\d{4})[.-](\d{1,2})[.-](\d{1,2})(?:\([^)]*\))?$/.exec(value.trim());
  if (!match) return null;

  const year = match[1].length === 2 ? 2000 + Number(match[1]) : Number(match[1]);
  return validCalendarParts(year, Number(match[2]), Number(match[3]));
}

export function parseApiDate(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const calendarParts = calendarValueParts(trimmed);
  if (calendarParts) {
    return new Date(Date.UTC(calendarParts.year, calendarParts.month - 1, calendarParts.day));
  }

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const normalized = trimmed.includes("T") || trimmed.includes(" ")
    ? `${trimmed.replace(" ", "T")}${hasTimezone ? "" : "Z"}`
    : trimmed;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function displayParts(value: string): CalendarParts | null {
  const calendarParts = calendarValueParts(value);
  if (calendarParts) return calendarParts;

  const parsed = parseApiDate(value);
  if (!parsed) return null;
  const kst = new Date(parsed.getTime() + KST_OFFSET_MS);
  return {
    year: kst.getUTCFullYear(),
    month: kst.getUTCMonth() + 1,
    day: kst.getUTCDate(),
    weekday: WEEKDAYS[kst.getUTCDay()],
    hours: kst.getUTCHours(),
    minutes: kst.getUTCMinutes(),
  };
}

function shortDateBase(parts: CalendarParts) {
  return `${String(parts.year).slice(2)}.${String(parts.month).padStart(2, "0")}.${String(parts.day).padStart(2, "0")}`;
}

function time24Base(parts: CalendarParts) {
  return `${String(parts.hours).padStart(2, "0")}:${String(parts.minutes).padStart(2, "0")}`;
}

export function koreaDateTimeInputToUtcISOString(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hours = Number(hourValue);
  const minutes = Number(minuteValue);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  const isValid = year >= 1000
    && year <= 9999
    && month >= 1
    && month <= 12
    && day >= 1
    && calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
    && hours >= 0
    && hours <= 23
    && minutes >= 0
    && minutes <= 59;
  if (!isValid) return null;

  return new Date(Date.UTC(year, month - 1, day, hours - KST_OFFSET_HOURS, minutes)).toISOString();
}

export function utcApiDateTimeToKoreaInput(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  if (!parts) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}T${time24Base(parts)}`;
}

export function formatBoardDate(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  return parts ? `${shortDateBase(parts)}(${parts.weekday})` : value;
}

export function formatShortDate(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  return parts ? shortDateBase(parts) : value;
}

export function formatBoardDateTime(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  return parts ? `${shortDateBase(parts)}(${parts.weekday}) · ${time24Base(parts)}` : value;
}

export function formatMonthDayTime(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  return parts ? `${parts.month}월 ${parts.day}일(${parts.weekday}) ${time24Base(parts)}` : "";
}

export function formatTime24(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  return parts ? time24Base(parts) : "";
}

export function formatHomeScheduleDate(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  if (!parts) return "";
  return `${String(parts.month).padStart(2, "0")}.${String(parts.day).padStart(2, "0")}(${parts.weekday})`;
}

export function formatKoreanTime(value?: string | null): string {
  if (!value) return "";
  const parts = displayParts(value);
  if (!parts) return "";
  const period = parts.hours < 12 ? "오전" : "오후";
  return `${period} ${parts.hours % 12 || 12}:${String(parts.minutes).padStart(2, "0")}`;
}

export function formatRelativeTime(value: string, now = Date.now()): string {
  const parsed = parseApiDate(value);
  if (!parsed) return "";

  const diffSeconds = Math.max(0, Math.floor((now - parsed.getTime()) / 1000));
  if (diffSeconds < 60) return "방금 전";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}분 전`;

  const parts = displayParts(value);
  return parts ? time24Base(parts) : "";
}
