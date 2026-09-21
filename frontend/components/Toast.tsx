import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ToastAlertIcon } from "./icons";
import { TOAST_DURATION_MS, TOAST_FADE_OUT_MS, toastHoldMs, type ToastState } from "../utils/toast";

type Props = {
  toast: ToastState;
  onHide: () => void;
  durationMs?: number;
};

/**
 * 화면 하단에 잠깐 떴다 사라지는 안내. Figma Component/Toast-* 를 옮긴 것으로,
 * 누를 것이 없어 사용자의 입력을 막지 않는다. 어떤 칸이 문제인지는 해당
 * 입력칸의 빨간 테두리가 알려주므로 문구에는 항목명을 넣지 않는다.
 *
 * durationMs는 뜬 순간부터 사라질 때까지의 전체 시간이다. 오류 알림이라
 * 등장은 즉시이고, 마지막에만 서서히 흐려진다.
 */
export default function Toast({ toast, onHide, durationMs = TOAST_DURATION_MS }: Props) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  // id가 바뀔 때마다 처음부터 다시 보여준다. 같은 문구가 연달아 떠도 시간이 초기화된다.
  const toastId = toast?.id;

  useEffect(() => {
    if (toastId === undefined) return undefined;
    opacity.stopAnimation();
    opacity.setValue(1);
    const animation = Animated.timing(opacity, {
      toValue: 0,
      delay: toastHoldMs(durationMs),
      duration: TOAST_FADE_OUT_MS,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onHide();
    });
    return () => animation.stop();
  }, [durationMs, onHide, opacity, toastId]);

  if (!toast) return null;

  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="none"
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 0) + 24 }]}
    >
      <Animated.View style={[styles.toast, { opacity }]}>
        <ToastAlertIcon size={18} />
        <Text style={styles.message}>{toast.message}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  // Figma: 배경 #1F2129, radius 10, padding 16/12, gap 8, 그림자 0 4 12 rgba(0,0,0,0.15)
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    borderRadius: 10,
    backgroundColor: "#1F2129",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    flexShrink: 1,
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
});
