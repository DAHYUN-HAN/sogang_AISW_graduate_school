import { create } from "zustand";

// Keep mounted screens and drafts intact while a single app-wide overlay is shown.
// 인터넷 끊김(disconnected)은 네트워크 오류, 서버 조회 실패(serverFailed)는 LoadError 화면을 띄운다.
export const useNetworkStatusStore = create<{
  disconnected: boolean;
  serverFailed: boolean;
  revision: number;
  markDisconnected: () => void;
  markServerFailed: () => void;
  clearIfUnchanged: (revision: number) => void;
}>((set) => ({
  disconnected: false,
  serverFailed: false,
  revision: 0,
  markDisconnected: () => set(state => ({ disconnected: true, revision: state.revision + 1 })),
  markServerFailed: () => set(state => ({ serverFailed: true, revision: state.revision + 1 })),
  clearIfUnchanged: (revision) => set(state => state.revision === revision ? { disconnected: false, serverFailed: false } : {}),
}));

const retries = new Map<symbol, () => void | Promise<unknown>>();
export function registerNetworkRetry(retry: () => void | Promise<unknown>) {
  const key = Symbol();
  retries.set(key, retry);
  return () => { retries.delete(key); };
}
export async function retryNetworkReads(probe: () => Promise<unknown>, refreshQueries: () => Promise<unknown>) {
  try {
    await probe();
    const revision = useNetworkStatusStore.getState().revision;
    await Promise.allSettled([refreshQueries(), ...Array.from(retries.values(), retry => Promise.resolve().then(retry))]);
    useNetworkStatusStore.getState().clearIfUnchanged(revision);
  } catch {
    // A failed probe keeps the single error screen open.
  }
}
