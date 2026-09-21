// 자료공유 게시판마다 본문 외에 따로 받아야 하는 입력이 있다. 게시판이 늘어나도
// create.tsx에 slug 분기를 더하지 않도록, 필요한 필드를 이 표 한 곳에만 선언한다.

export const RESOURCE_RATING_LEVELS = ["상", "중", "하"] as const;
export type ResourceRatingLevel = (typeof RESOURCE_RATING_LEVELS)[number];

export type ResourcePostFields = {
  titlePlaceholder: string;
  professor: boolean;
  difficulty: boolean;
  satisfaction: boolean;
  // 목록 카드에서 본문 미리보기 대신 과목정보를 보여줄지. 디자인상 강의후기만 그렇다.
  subjectInListCard: boolean;
};

export type ResourcePostFieldValues = {
  professor?: string;
  difficulty?: string;
  satisfaction?: string;
};

const RESOURCE_POST_FIELDS: Record<string, ResourcePostFields> = {
  "lecture-reviews": {
    titlePlaceholder: "강의명을 입력하세요",
    professor: true,
    difficulty: true,
    satisfaction: true,
    subjectInListCard: true,
  },
  "exam-archive": {
    titlePlaceholder: "강의명을 입력하세요",
    professor: true,
    difficulty: false,
    satisfaction: false,
    subjectInListCard: false,
  },
};

// metadata 키는 기존 posts.metadata 관례(application_url 등)에 맞춘 snake_case다.
const METADATA_KEYS = {
  professor: "professor_name",
  difficulty: "lecture_difficulty",
  satisfaction: "lecture_satisfaction",
} as const;

/**
 * 등급 입력은 표시 라벨만 다르고 동작이 같다. 작성·수정 화면이 같은 순서와
 * 문구를 쓰도록 여기서 한 번만 선언한다.
 */
export const RESOURCE_RATING_FIELDS = [
  { name: "difficulty", label: "강의 난이도" },
  { name: "satisfaction", label: "강의 만족도" },
] as const;

export function resourcePostFields(boardSlug?: string | null): ResourcePostFields | null {
  if (!boardSlug) return null;
  return RESOURCE_POST_FIELDS[boardSlug] ?? null;
}

function ratingLevel(value: unknown): ResourceRatingLevel | undefined {
  return RESOURCE_RATING_LEVELS.find((level) => level === value);
}

function trimmed(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text || undefined;
}

/** 저장할 metadata를 만든다. 게시판이 쓰지 않는 필드는 값이 있어도 버린다. */
export function resourcePostMetadata(
  fields: ResourcePostFields | null,
  values: ResourcePostFieldValues,
): Record<string, string> {
  if (!fields) return {};
  const metadata: Record<string, string> = {};
  const professor = fields.professor ? trimmed(values.professor) : undefined;
  if (professor) metadata[METADATA_KEYS.professor] = professor;
  const difficulty = fields.difficulty ? ratingLevel(values.difficulty) : undefined;
  if (difficulty) metadata[METADATA_KEYS.difficulty] = difficulty;
  const satisfaction = fields.satisfaction ? ratingLevel(values.satisfaction) : undefined;
  if (satisfaction) metadata[METADATA_KEYS.satisfaction] = satisfaction;
  return metadata;
}

export const RESOURCE_SUBJECT_SEPARATOR = " · ";

export type ResourceSubjectTone = "professor" | "difficulty" | "satisfaction";
export type ResourceSubjectSegment = { tone: ResourceSubjectTone; text: string };

/**
 * 상세·목록에 보여줄 과목정보 조각들. 상세는 조각마다 색이 다르고 목록은 단색이라
 * 색은 화면이 정하고 여기서는 순서와 문구만 만든다. 값이 없는 항목은 건너뛰므로
 * metadata를 채우지 않은 예전 글은 빈 배열이 된다.
 */
export function resourceSubjectSegments(
  boardSlug?: string | null,
  metadata?: Record<string, unknown> | null,
): ResourceSubjectSegment[] {
  const fields = resourcePostFields(boardSlug);
  if (!fields || !metadata) return [];
  const segments: ResourceSubjectSegment[] = [];
  const professor = fields.professor ? trimmed(metadata[METADATA_KEYS.professor]) : undefined;
  if (professor) segments.push({ tone: "professor", text: `${professor} 교수` });
  const difficulty = fields.difficulty ? ratingLevel(metadata[METADATA_KEYS.difficulty]) : undefined;
  if (difficulty) segments.push({ tone: "difficulty", text: `난이도 ${difficulty}` });
  const satisfaction = fields.satisfaction ? ratingLevel(metadata[METADATA_KEYS.satisfaction]) : undefined;
  if (satisfaction) segments.push({ tone: "satisfaction", text: `만족도 ${satisfaction}` });
  return segments;
}

/** 목록 카드용 단색 한 줄. 과목정보를 쓰지 않는 게시판과 값이 없는 글은 빈 문자열이다. */
export function resourceSubjectSummary(
  boardSlug?: string | null,
  metadata?: Record<string, unknown> | null,
): string {
  if (!resourcePostFields(boardSlug)?.subjectInListCard) return "";
  return resourceSubjectSegments(boardSlug, metadata)
    .map((segment) => segment.text)
    .join(RESOURCE_SUBJECT_SEPARATOR);
}

/**
 * 수정 화면 프리필용. 서버가 수정 시 metadata를 교체하므로(_metadata_for_update),
 * 기존 값을 폼으로 되돌려놓지 않으면 저장할 때 유실된다.
 */
export function resourcePostFieldValues(
  fields: ResourcePostFields | null,
  metadata?: Record<string, unknown> | null,
): ResourcePostFieldValues {
  if (!fields || !metadata) return {};
  return {
    professor: fields.professor ? trimmed(metadata[METADATA_KEYS.professor]) ?? "" : "",
    difficulty: fields.difficulty ? ratingLevel(metadata[METADATA_KEYS.difficulty]) ?? "" : "",
    satisfaction: fields.satisfaction ? ratingLevel(metadata[METADATA_KEYS.satisfaction]) ?? "" : "",
  };
}

/**
 * 기존 metadata에 과목정보를 갱신해 얹는다. 먼저 과목정보 키를 모두 지우므로,
 * 강의후기 글을 시험족보로 옮기면 새 게시판이 쓰지 않는 난이도·만족도가 남지
 * 않는다. 과목정보와 무관한 키(application_url 등)는 그대로 둔다.
 */
export function withResourcePostMetadata(
  existing: Record<string, unknown> | null | undefined,
  fields: ResourcePostFields | null,
  values: ResourcePostFieldValues,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(existing ?? {}) };
  for (const key of Object.values(METADATA_KEYS)) delete next[key];
  return { ...next, ...resourcePostMetadata(fields, values) };
}
