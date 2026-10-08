import { useEffect, type ReactNode } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { AppText as Text } from "./AppTypography";
import { isNetworkError } from "../utils/networkError";
import { registerNetworkRetry } from "../stores/networkStatusStore";

export function NetworkErrorFallback({ error, onRetry, children }: { error: unknown; onRetry: () => void; children: ReactNode }) {
  const focused = useIsFocused();
  const networkError = isNetworkError(error);
  useEffect(() => {
    if (focused && networkError) return registerNetworkRetry(onRetry);
  }, [focused, networkError, onRetry]);
  return isNetworkError(error) ? <NetworkErrorState onRetry={onRetry} /> : <>{children}</>;
}

export default function NetworkErrorState({ onRetry, retrying = false }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon} accessible={false}>
        <Svg width={35} height={35} viewBox="0 0 24 24" style={styles.wifi}>
          <Path fill="#D64545" d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.24 4.24 0 0 0-6 0zm-4-4l2 2a7.07 7.07 0 0 1 10 0l2-2c-3.86-3.86-10.13-3.86-14 0z" />
        </Svg>
      </View>
      <Text style={styles.title}>네트워크 연결이 원활하지 않아요</Text>
      <Text style={styles.description}>인터넷 연결 상태를 확인한 후 다시 시도해주세요</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="다시 시도" accessibilityState={{ disabled: retrying, busy: retrying }} disabled={retrying} onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>다시 시도</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", minHeight: 218, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF", paddingVertical: 20.5 },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  wifi: { marginLeft: 1 },
  title: { marginTop: 16, color: "#15171C", fontWeight: "500", fontSize: 16, lineHeight: 19, textAlign: "center" },
  description: { marginTop: 6, color: "#6B7280", fontWeight: "400", fontSize: 13, lineHeight: 16, textAlign: "center" },
  retryButton: { marginTop: 24, width: 100, height: 48, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2761FF", borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "500", fontSize: 14, lineHeight: 17 },
});
