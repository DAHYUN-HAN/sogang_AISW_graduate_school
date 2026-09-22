export type ClubOperationStatus = "active" | "ended";

export function clubOperationStatus(metadata?: Record<string, unknown> | null): ClubOperationStatus {
  return metadata?.club_operation_status === "ended" ? "ended" : "active";
}

export function participationApplicationUrl(metadata?: Record<string, unknown> | null) {
  const value = metadata?.application_url;
  if (typeof value !== "string") return undefined;
  return value.trim() || undefined;
}
