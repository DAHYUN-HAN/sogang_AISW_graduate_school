export function formatCohortName(cohort?: string | null, name?: string | null) {
  const normalizedCohort = cohort?.trim().replace(/기$/, "");
  const normalizedName = name?.trim();
  const cohortPrefix = normalizedCohort ? `${normalizedCohort}기` : "";
  // 닉네임이 "72기_이름" 또는 로마자 표기 "72gi_이름"으로 시작하면 기수를 한 번만 보여 준다.
  const duplicatePrefix = normalizedCohort
    ? new RegExp(`^${normalizedCohort}(?:기|gi)[_\\s-]*`, "i")
    : null;
  const stripped = normalizedName && duplicatePrefix ? normalizedName.replace(duplicatePrefix, "").trim() : normalizedName;
  const displayName = stripped || normalizedName;
  return [cohortPrefix || null, displayName || null].filter(Boolean).join(" ");
}
