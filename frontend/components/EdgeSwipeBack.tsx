import type { ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

// iOS 기본 스와이프(gestureEnabled)를 끈 화면에서, 왼쪽 가장자리를 오른쪽으로 쓸면
// 안드로이드 뒤로가기와 같은 onBack을 실행한다. 화면은 손가락을 따라 움직이지 않고
// 손을 뗐을 때 충분히 밀었으면 한 번 실행한다. 기본 스와이프가 켜진 화면에 같이 걸면
// 둘이 같은 가장자리를 두고 다투므로, 기본 스와이프를 끈 화면에서만 쓴다.
const EDGE_WIDTH = 25; // iOS 기본 가장자리 구역과 비슷한 폭
const TRIGGER_DISTANCE = 60;
const TRIGGER_VELOCITY = 500;

export default function EdgeSwipeBack({ children, onBack }: { children: ReactNode; onBack: () => void }) {
  const gesture = Gesture.Pan()
    .enabled(Platform.OS === "ios")
    .hitSlop({ left: 0, width: EDGE_WIDTH })
    .activeOffsetX(10)
    .failOffsetY([-15, 15])
    .runOnJS(true)
    .onEnd((event, success) => {
      if (!success) return;
      if (event.translationX >= TRIGGER_DISTANCE || event.velocityX >= TRIGGER_VELOCITY) onBack();
    });

  return (
    <GestureHandlerRootView style={styles.root}>
      <GestureDetector gesture={gesture}>
        <View collapsable={false} style={styles.root}>
          {children}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
