import type { MutualAidStatus } from "../types";

const EVENT_TYPE_LABELS: Record<string, string> = {
  marriage: "결혼",
  wedding: "결혼",
  bereavement: "부고",
  funeral: "부고",
};

const RELATION_LABELS: Record<string, string> = {
  self: "본인",
  spouse: "배우자",
  parent: "부모",
  child: "자녀",
  sibling: "형제/자매",
};

export function canEditMutualAidRequest(status?: MutualAidStatus | null): boolean {
  return status === "processing";
}

export function canDeleteMutualAidRequest(status?: MutualAidStatus | null): boolean {
  return status === "processing" || status === "rejected";
}

export function normalizeMutualAidEventDate(value?: string | null): string {
  return value?.trim().replaceAll("-", ".") ?? "";
}

export function isUnchangedMutualAidEventDate(nextValue?: string | null, storedValue?: string | null): boolean {
  return normalizeMutualAidEventDate(nextValue) === normalizeMutualAidEventDate(storedValue);
}

export function mutualAidEventTypeLabel(value?: string | null): string {
  const normalized = value?.trim() ?? "";
  return EVENT_TYPE_LABELS[normalized.toLowerCase()] ?? normalized;
}

export function mutualAidRelationLabel(value?: string | null): string {
  const normalized = value?.trim() ?? "";
  return RELATION_LABELS[normalized.toLowerCase()] ?? normalized;
}

export const EVIDENCE_LINK_MAX_LENGTH = 500;

/**
 * 증빙 링크(청첩장·부고장 주소) 검사. http(s)만 허용하고, 호스트는 점으로
 * 구분된 라벨이 둘 이상이면서 빈 라벨이 없어야 한다. `http://www.`처럼
 * 도메인을 덜 입력한 주소를 걸러내기 위한 규칙이며, 서버도 같은 기준을 쓴다.
 */
export function isValidEvidenceLink(value?: string | null): boolean {
  const link = value?.trim() ?? "";
  if (!link || link.length > EVIDENCE_LINK_MAX_LENGTH) return false;
  let hostname: string;
  try {
    const parsed = new URL(link);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    hostname = parsed.hostname;
  } catch {
    return false;
  }
  return isValidEvidenceLinkHost(hostname);
}

export function isValidEvidenceLinkHost(hostname: string): boolean {
  const labels = hostname.split(".");
  if (labels.length < 2) return false;
  if (labels.some((label) => label.length === 0)) return false;
  // 마지막 라벨(TLD)이 한 글자인 주소는 실제로 쓰이지 않는다. 퓨니코드(xn--)와
  // 한글 도메인을 막지 않도록 글자 종류는 제한하지 않는다.
  return labels[labels.length - 1].length >= 2;
}
