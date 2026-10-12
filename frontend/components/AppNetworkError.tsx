import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import { api, API_ORIGIN } from "../services/api";
import { retryNetworkReads, useNetworkStatusStore } from "../stores/networkStatusStore";
import NetworkErrorState, { LoadErrorState } from "./NetworkErrorState";

export default function AppNetworkError() {
  const disconnected = useNetworkStatusStore(state => state.disconnected);
  const serverFailed = useNetworkStatusStore(state => state.serverFailed);
  const queryClient = useQueryClient();
  const pending = useRef(false);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => { if (disconnected || serverFailed) Keyboard.dismiss(); }, [disconnected, serverFailed]);
  if (!disconnected && !serverFailed) return null;
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
      {/* 인터넷이 끊겼으면 네트워크 오류, 서버가 조회에 실패했으면 LoadError. 둘 다면 인터넷 먼저. */}
      {disconnected
        ? <NetworkErrorState onRetry={() => void retry()} retrying={retrying} />
        : <LoadErrorState onRetry={() => void retry()} retrying={retrying} />}
    </View>
  );
}
const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "#FFFFFF", justifyContent: "center", paddingHorizontal: 20, zIndex: 200, elevation: 200, shadowColor: "transparent" },
});
