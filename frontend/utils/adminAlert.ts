import { Alert, Platform, type AlertButton, type AlertOptions } from "react-native";
import { useMemo, useSyncExternalStore } from "react";
import { useUserStore } from "../stores/userStore";
import { createAdminDialogQueue } from "./adminDialogQueue";

export const adminDialogQueue = createAdminDialogQueue();
const sessionIdentity = () => {
  const state = useUserStore.getState();
  return state.isAuthenticated && state.user
    ? `${state.user.id}:${state.user.role}:${state.sessionGeneration}` : "guest";
};
let currentSession = sessionIdentity();
useUserStore.subscribe(() => {
  const nextSession = sessionIdentity();
  if (nextSession === currentSession) return;
  currentSession = nextSession;
  // Zustand publishes synchronously: old callbacks disappear before React rerenders.
  adminDialogQueue.clear();
});

/** Capture the originating session/generation so late async prompts cannot cross sessions. */
export function useAdminAlert() {
  const generation = useSyncExternalStore(adminDialogQueue.subscribe, adminDialogQueue.generation, adminDialogQueue.generation);
  return useMemo(() => {
    const session = sessionIdentity();
    return {alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) {
      if (generation !== adminDialogQueue.generation() || session !== sessionIdentity()) return;
      if (Platform.OS !== "web") return Alert.alert(title, message, buttons, options);
      if (session === "guest") return;
      adminDialogQueue.push({title, message, buttons, cancelable: options?.cancelable, onDismiss: options?.onDismiss});
    }};
  }, [generation]);
}
