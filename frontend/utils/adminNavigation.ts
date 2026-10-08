export const ADMIN_PAGES = [
  { key: "main", path: "/admin", label: "메인", icon: "home-outline" },
  { key: "dashboard", path: "/admin/dashboard", label: "대시보드", icon: "speedometer-outline" },
  { key: "banners", path: "/admin/banners", label: "배너", icon: "albums-outline" },
  { key: "boardManagement", path: "/admin/boards", label: "게시판 관리", icon: "grid-outline" },
  { key: "accounts", path: "/admin/accounts", label: "회원 관리", icon: "people-outline" },
  { key: "studentRoster", path: "/admin/roster", label: "원우 명부", icon: "reader-outline" },
  { key: "duesPayments", path: "/admin/dues", label: "원우회비", icon: "wallet-outline" },
  { key: "reports", path: "/admin/reports", label: "신고", icon: "flag-outline" },
  { key: "registration", path: "/admin/registration", label: "가입 설정", icon: "person-add-outline" },
  { key: "audit", path: "/admin/audit-logs", label: "운영 기록", icon: "time-outline" },
  { key: "migration", path: "/admin/migration-review", label: "이관 검수", icon: "server-outline" },
] as const;

export type AdminSection = (typeof ADMIN_PAGES)[number]["key"];

export function adminSectionPath(section: AdminSection) {
  return ADMIN_PAGES.find((page) => page.key === section)!.path;
}

export function adminSectionFromPath(pathname: string): AdminSection | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path.startsWith("/admin/boards/")) return "boardManagement";
  return ADMIN_PAGES.find((page) => page.path === path)?.key ?? null;
}

export function resolveAdminSection(pathname: string, legacySection: string | string[] | undefined, platform: string): AdminSection {
  const fromPath = adminSectionFromPath(pathname);
  if (fromPath && pathname.replace(/\/+$/, "") !== "/admin") return fromPath;
  const legacy = Array.isArray(legacySection) ? legacySection[0] : legacySection;
  if (ADMIN_PAGES.some((page) => page.key === legacy)) return legacy as AdminSection;
  if (["boards", "notices", "posts", "council", "executives", "cohortLeaders", "pastCouncils", "mutualAid", "suggestions", "events", "faqs"].includes(legacy ?? "")) return "boardManagement";
  return platform === "web" ? "main" : "dashboard";
}

export function adminPostPath(mode: "detail" | "edit" | "create", id: number) {
  return mode === "create" ? `/admin/boards/create?boardId=${id}` : `/admin/boards/post/${id}${mode === "edit" ? "/edit" : ""}`;
}

/** Reuse existing post workflows while keeping their navigation in the admin workspace. */
export function adminDestination<T extends string | { pathname: string; params?: unknown }>(href: T): T {
  const original = typeof href === "string" ? href : href.pathname;
  const [path, ...query] = original.split("?");
  let target = path;
  if (path === "/board/post/create") target = "/admin/boards/create";
  else if (/^\/board\/post\/edit\/\d+$/.test(path)) target = `/admin/boards/post/${path.split("/").pop()}/edit`;
  else if (/^\/board\/post\/\d+$/.test(path)) target = `/admin/boards/post/${path.split("/").pop()}`;
  else if (/^\/board\/\d+$/.test(path) || path === "/board" || path === "/(tabs)/board") target = "/admin/boards";
  else if (/^\/(?:\(tabs\)\/)?(?:home|notices|community|participation|council|notifications|search|settings(?:\/activity)?)(?:\/|$)/.test(path)) target = "/admin/boards";
  const destination = `${target}${query.length ? `?${query.join("?")}` : ""}`;
  return (typeof href === "string" ? destination : { ...(href as { pathname: string; params?: unknown }), pathname: destination }) as T;
}
