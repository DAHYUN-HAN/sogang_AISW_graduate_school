import { create } from "zustand";

// Keep mounted screens and drafts intact while a single app-wide overlay is shown.
export const useNetworkStatusStore = create<{
  disconnected: boolean;
  revision: number;
  markDisconnected: () => void;
  clearIfUnchanged: (revision: number) => void;
}>((set) => ({
  disconnected: false,
  revision: 0,
  markDisconnected: () => set(state => ({ disconnected: true, revision: state.revision + 1 })),
  clearIfUnchanged: (revision) => set(state => state.revision === revision ? { disconnected: false } : {}),
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
