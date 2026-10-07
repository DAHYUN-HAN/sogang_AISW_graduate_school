import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { api, API_ORIGIN } from "../services/api";
import { retryNetworkReads, useNetworkStatusStore } from "../stores/networkStatusStore";
import NetworkErrorState from "./NetworkErrorState";

export default function AppNetworkError() {
  const disconnected = useNetworkStatusStore(state => state.disconnected);
  const queryClient = useQueryClient();
  const pending = useRef(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => { if (disconnected) Keyboard.dismiss(); }, [disconnected]);
  if (!disconnected) return null;
  const retry = async () => {
    if (pending.current) return;
    pending.current = true;
    setRetrying(true);
    try {
      await retryNetworkReads(
        () => api.get(`${API_ORIGIN}/health`, { timeout: 5000 }),
        () => queryClient.invalidateQueries({ refetchType: "active" }),
      );
    } finally {
      pending.current = false;
      setRetrying(false);
    }
  };
  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <NetworkErrorState onRetry={() => void retry()} retrying={retrying} />
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", justifyContent: "center", paddingHorizontal: 20, zIndex: 200, elevation: 200, shadowColor: "transparent" },
});
