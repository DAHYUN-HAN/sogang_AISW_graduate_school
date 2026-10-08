export type UsageScreen = "home" | "notices" | "community" | "participation" | "council" | "board" | "post" | "settings" | "search" | "notifications" | "faq";

export function usageScreen(pathname: string): UsageScreen | null {
  if (/^\/board\/post(?:\/|$)/.test(pathname)) return "post";
  const root = pathname.split("/").filter(Boolean)[0];
  return ["home", "notices", "community", "participation", "council", "board", "settings", "search", "notifications", "faq"].includes(root) ? root as UsageScreen : null;
}

export function createNavigationTracker() {
  let last: string | null = null;
  return {
    visit(path: string, userId: number | null, role: string | null, resume = false): UsageScreen | null {
      const screen = usageScreen(path);
      if (!userId || role !== "user" || !screen) { last = null; return null; }
      const key = `${userId}:${path}`;
      if (!resume && last === key) return null;
      last = key;
      return screen;
    },
  };
}

export function usageUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  // This identifier does not authenticate, authorize or secure an account.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const value = Math.floor(Math.random() * 16);
    return (c === "x" ? value : (value & 3) | 8).toString(16);
  });
}

export function shouldRecordUsageResume(awayAt: number, now: number) {
  return now - awayAt >= 30 * 60 * 1000;
}
