import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { create } from "zustand";

import type { AuthUser } from "../types";

type StoredSession = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
};

type UserState = StoredSession & {
  sessionGeneration: number;
  userId: number | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;
  hydrateSession: () => Promise<void>;
  setSession: (session: { access_token: string; refresh_token: string; user: AuthUser }, options?: { preserveSession?: boolean }) => void;
  clearSession: () => void;
};

const STORAGE_KEY = "aisw-auth-session";
const EMPTY_SESSION: StoredSession = { accessToken: null, refreshToken: null, user: null };

function parseSession(raw: string | null): StoredSession {
  if (!raw) return EMPTY_SESSION;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    return {
      accessToken: typeof parsed.accessToken === "string" ? parsed.accessToken : null,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : null,
      user: parsed.user && typeof parsed.user.id === "number" ? (parsed.user as AuthUser) : null,
    };
  } catch {
    return EMPTY_SESSION;
  }
}

function readWebSession() {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") return EMPTY_SESSION;
  return parseSession(localStorage.getItem(STORAGE_KEY));
}

async function readStoredSession() {
  if (Platform.OS === "web") return readWebSession();
  try {
    return parseSession(await SecureStore.getItemAsync(STORAGE_KEY));
  } catch {
    return EMPTY_SESSION;
  }
}

async function writeStoredSession(session: StoredSession) {
  const raw = JSON.stringify(session);
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, raw);
    return;
  }
  await SecureStore.setItemAsync(STORAGE_KEY, raw, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function clearStoredSession() {
  if (Platform.OS === "web") {
    if (typeof localStorage !== "undefined") localStorage.removeItem(STORAGE_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(STORAGE_KEY);
}

const initialSession = readWebSession();

export const useUserStore = create<UserState>((set, get) => ({
  ...initialSession,
  sessionGeneration: initialSession.accessToken && initialSession.refreshToken && initialSession.user ? 1 : 0,
  userId: initialSession.user?.id ?? null,
  isAuthenticated: Boolean(initialSession.accessToken && initialSession.refreshToken && initialSession.user),
  hasHydrated: Platform.OS === "web",
  hydrateSession: async () => {
    if (get().hasHydrated) return;
    const stored = await readStoredSession();
    set({
      ...stored,
      sessionGeneration: get().sessionGeneration + 1,
      userId: stored.user?.id ?? null,
      isAuthenticated: Boolean(stored.accessToken && stored.refreshToken && stored.user),
      hasHydrated: true,
    });
  },
  setSession: (session, options) => {
    const current = get();
    const preserveSession = options?.preserveSession && current.isAuthenticated
      && current.user?.id === session.user.id && current.user.role === session.user.role;
    const next = {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      user: session.user,
    };
    void writeStoredSession(next);
    set({ ...next, sessionGeneration: current.sessionGeneration + (preserveSession ? 0 : 1), userId: session.user.id, isAuthenticated: true, hasHydrated: true });
  },
  clearSession: () => {
    void clearStoredSession();
    set({ ...EMPTY_SESSION, sessionGeneration: get().sessionGeneration + 1, userId: null, isAuthenticated: false, hasHydrated: true });
  },
}));
