import { useEffect, type ReactNode } from "react";
import { useIsFocused } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { AppText as Text } from "./AppTypography";
import { isLoadFailure, isNetworkError, isServerLoadError } from "../utils/networkError";
import { registerNetworkRetry, useNetworkStatusStore } from "../stores/networkStatusStore";
import { BUTTON_TEXT } from "../utils/buttonText";

export function NetworkErrorFallback({ error, onRetry, children }: { error: unknown; onRetry: () => void; children: ReactNode }) {
  const focused = useIsFocused();
  const networkError = isNetworkError(error);
  // 서버 조회 실패도 앱 전체 LoadError의 "다시 시도"로 이 화면을 다시 불러온다.
  const retryable = networkError || isServerLoadError(error);
  useEffect(() => {
    if (focused && retryable) return registerNetworkRetry(onRetry);
  }, [focused, retryable, onRetry]);
  return isNetworkError(error) ? <NetworkErrorState onRetry={onRetry} /> : <>{children}</>;
}

// 조회 실패(4xx 포함)를 화면 안 오류 상자 대신 앱 전체 LoadError로 덮는다.
// "다시 시도"는 이 화면의 onRetry로 다시 받고, 또 실패하면 덮개가 그대로 남는다.
export function useLoadErrorOverlay(error: unknown, onRetry: () => void) {
  const focused = useIsFocused();
  const failed = isLoadFailure(error);
  useEffect(() => {
    if (focused && failed) useNetworkStatusStore.getState().markServerFailed();
  }, [focused, failed, error]);
  useEffect(() => {
    if (focused && (failed || isNetworkError(error))) return registerNetworkRetry(onRetry);
  }, [focused, failed, error, onRetry]);
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

// 피그마 Screen/Common/LoadError(1923:64). 네트워크 오류 화면과 같은 틀에 아이콘·문구만 다르다.
export function LoadErrorState({ onRetry, retrying = false }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <View style={styles.container} accessibilityRole="alert">
      <View style={styles.icon} accessible={false}>
        <Svg width={48} height={48} viewBox="0 0 48 48">
          <Circle cx={24} cy={24} r={20} stroke="#D64545" strokeWidth={2.5} fill="none" />
          <Rect x={22.3} y={13} width={3.4} height={13} rx={1.7} fill="#D64545" />
          <Circle cx={24} cy={31.8} r={1.8} fill="#D64545" />
        </Svg>
      </View>
      <Text style={styles.title}>페이지를 불러오지 못했어요</Text>
      <Text style={styles.description}>잠시 후 다시 시도해주세요</Text>
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
  retryButton: { marginTop: 24, minWidth: 100, minHeight: 48, paddingHorizontal: 24, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#2761FF", borderRadius: 8 },
  retryText: { ...BUTTON_TEXT, color: "#FFFFFF", fontWeight: "500" },
});
