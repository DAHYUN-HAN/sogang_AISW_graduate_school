// 자료공유 게시판마다 본문 외에 따로 받아야 하는 입력이 있다. 게시판이 늘어나도
// create.tsx에 slug 분기를 더하지 않도록, 필요한 필드를 이 표 한 곳에만 선언한다.

export const RESOURCE_RATING_LEVELS = ["상", "중", "하"] as const;
export type ResourceRatingLevel = (typeof RESOURCE_RATING_LEVELS)[number];

export type ResourcePostFields = {
  titlePlaceholder: string;
  professor: boolean;
  difficulty: boolean;
  satisfaction: boolean;
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
  },
  "exam-archive": {
    titlePlaceholder: "강의명을 입력하세요",
    professor: true,
    difficulty: false,
    satisfaction: false,
  },
};

// metadata 키는 기존 posts.metadata 관례(application_url 등)에 맞춘 snake_case다.
const METADATA_KEYS = {
  professor: "professor_name",
  difficulty: "lecture_difficulty",
  satisfaction: "lecture_satisfaction",
} as const;

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
