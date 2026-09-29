export type EventDisplayCategory = "academic" | "event" | "other";
export type EventToneSurface = "day" | "detail";
export type EventCategoryTone = { backgroundColor: string; color: string };

export const EVENT_CATEGORY_OPTIONS = [
  { value: "academic", label: "학사일정" },
  { value: "event", label: "행사일정" },
  { value: "other", label: "기타일정" },
] as const;

const LABELS: Record<EventDisplayCategory, string> = {
  academic: "학사일정",
  event: "행사일정",
  other: "기타일정",
};

const TONES: Record<EventToneSurface, Record<EventDisplayCategory, EventCategoryTone>> = {
  day: {
    academic: { backgroundColor: "#E6F1FB", color: "#0C447C" },
    event: { backgroundColor: "#FBEAF0", color: "#993556" },
    other: { backgroundColor: "#F0EEF9", color: "#6543A2" },
  },
  detail: {
    academic: { backgroundColor: "#E6F1FB", color: "#0C447C" },
    event: { backgroundColor: "#FBEAF0", color: "#993556" },
    other: { backgroundColor: "#F0EEF9", color: "#6543A2" },
  },
};

export function eventDisplayCategory(raw: string | null | undefined): EventDisplayCategory {
  if (raw === "academic") return "academic";
  if (raw === "event") return "event";
  return "other";
}

export function eventCategoryLabel(raw: string | null | undefined): string {
  return LABELS[eventDisplayCategory(raw)];
}

export function eventCategoryTone(
  raw: string | null | undefined,
  surface: EventToneSurface,
): EventCategoryTone {
  return TONES[surface][eventDisplayCategory(raw)];
}

export function eventCategoryValueForSubmit(selectedCategory: EventDisplayCategory): string {
  return selectedCategory;
}

// 홈 달력(Screen/Home-CalendarImproved)에서 쓰는 분류 강조색과 짧은 이름.
// 칩의 점, 날짜 아래 점, 일정카드 왼쪽 막대와 분류 글자가 같은 색을 쓴다.
// 바탕 없이 색만 얹는 자리라 day/detail 배지의 배경-글자 짝과는 별개로 둔다.
const CALENDAR_ACCENTS: Record<EventDisplayCategory, string> = {
  academic: "#0C447C",
  event: "#993556",
  other: "#6543A2",
};

const SHORT_LABELS: Record<EventDisplayCategory, string> = {
  academic: "학사",
  event: "행사",
  other: "기타",
};

// 점과 칩이 늘 같은 차례로 놓이도록 고정한다.
export const EVENT_CATEGORY_ORDER: EventDisplayCategory[] = ["academic", "event", "other"];

export function eventCategoryAccent(raw: string | null | undefined): string {
  return CALENDAR_ACCENTS[eventDisplayCategory(raw)];
}

export function eventCategoryShortLabel(raw: string | null | undefined): string {
  return SHORT_LABELS[eventDisplayCategory(raw)];
}

/**
 * 날짜 칸에 찍을 점의 최대 개수.
 *
 * 칸 너비는 (화면폭 - 좌우 여백 20x2 - 카드 패딩 14x2) / 7 이고, 점 4px에 간격 3px라
 * n개는 7n-3 만큼 차지한다. 홈이 상정하는 가장 좁은 화면(콘텐츠 280 = 화면폭 320)에서
 * 칸은 36px이므로 5개(32px)까지 들어가고 6개(39px)는 옆 칸을 침범한다.
 */
export const MAX_DAY_DOTS = 5;

/**
 * 그날 일정 하나당 점 하나. 같은 분류끼리 붙여 놓아야 색이 흩어지지 않는다.
 * 넘치는 개수는 잘라내고, 실제 개수는 선택한 날 머리말의 "일정 N개"가 알려준다.
 */
export function dayDotCategories(
  events: { category: string }[],
  limit = MAX_DAY_DOTS,
): EventDisplayCategory[] {
  return EVENT_CATEGORY_ORDER.flatMap((value) =>
    events.filter((event) => eventDisplayCategory(event.category) === value).map(() => value),
  ).slice(0, limit);
}

