import { useEffect, useRef } from "react";
import { usePathname } from "expo-router";
import { AppState, Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { usageApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import { createNavigationTracker, shouldRecordUsageResume, usageUuid } from "../utils/usageTracking";

const DEVICE_KEY = "aisw_usage_device";
let devicePromise: Promise<string> | undefined;
async function deviceId() {
  devicePromise ??= (async () => {
    try {
      const saved = Platform.OS === "web" ? localStorage.getItem(DEVICE_KEY) : await SecureStore.getItemAsync(DEVICE_KEY);
      if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
      const id = usageUuid();
      if (Platform.OS === "web") localStorage.setItem(DEVICE_KEY, id);
      else await SecureStore.setItemAsync(DEVICE_KEY, id);
      return id;
    } catch { return usageUuid(); }
  })();
  return devicePromise;
}

export default function UsageTracking() {
  const pathname = usePathname();
  const user = useUserStore((state) => state.user);
  const tracker = useRef(createNavigationTracker());
  useEffect(() => {
    const record = (resume = false) => {
      const screen = tracker.current.visit(pathname, user?.id ?? null, user?.role ?? null, resume);
      if (!screen) return;
      void (async () => {
        const device = await deviceId();
        if (useUserStore.getState().user?.id !== user?.id) return;
        const payload = { event_id: usageUuid(), device_id: device, screen };
        try { await usageApi.recordPageView(payload); } catch {
          // One retry with the same event identity; navigation never depends on analytics.
          if (useUserStore.getState().user?.id === user?.id) {
            try { await usageApi.recordPageView(payload); } catch { /* best effort */ }
          }
        }
      })();
    };
    record();
    let awayAt: number | null = null;
    const activate = () => {
      if (awayAt === null) return;
      const shouldRecord = shouldRecordUsageResume(awayAt, Date.now());
      awayAt = null;
      if (shouldRecord) record(true);
    };
    const deactivate = () => { awayAt ??= Date.now(); };
    if (Platform.OS === "web") {
      const visibility = () => document.hidden ? deactivate() : activate();
      window.addEventListener("blur", deactivate);
      window.addEventListener("focus", activate);
      document.addEventListener("visibilitychange", visibility);
      return () => {
        window.removeEventListener("blur", deactivate); window.removeEventListener("focus", activate);
        document.removeEventListener("visibilitychange", visibility);
      };
    }
    const subscription = AppState.addEventListener("change", (state) => state === "active" ? activate() : deactivate());
    return () => subscription.remove();
  }, [pathname, user?.id, user?.role]);
  return null;
}
