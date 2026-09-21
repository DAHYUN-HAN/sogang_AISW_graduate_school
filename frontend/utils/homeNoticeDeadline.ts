function deadlineDayOffset(value?: string | null, now = new Date()): number | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.round((targetDay.getTime() - today.getTime()) / 86_400_000);
}

export function noticeDeadlineLabel(value?: string | null, now = new Date()) {
  const days = deadlineDayOffset(value, now);
  if (days === null || days < 0) return "";

  if (days === 0) return "마감 D-day";
  return `마감 D-${days}`;
}

export function homeNoticeDeadlineSuffix(value?: string | null, now = new Date()) {
  const label = noticeDeadlineLabel(value, now);
  return label ? ` · ${label}` : "";
}

export function homeScheduleDdayLabel(value?: string | null, now = new Date()) {
  const days = deadlineDayOffset(value, now);
  if (days === null) return "";

  if (days < 0) return "마감";
  if (days === 0) return "D-day";
  return `D-${days}`;
}
