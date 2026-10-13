import { useNavigation } from "@react-navigation/native";
import { useLayoutEffect, type ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";

// iOS에서 왼쪽 가장자리를 오른쪽으로 쓸면 안드로이드 뒤로가기와 같은 onBack을 실행한다.
// active인 동안 이 화면의 기본 스와이프(gestureEnabled)를 끈다. 기본 스와이프는 UIKit이
// 화면째 꺼낸 뒤에야 JS에 알려서, usePreventRemove로 막으면 아래 화면이 비쳤다가
// 돌아오는 "튕김"이 생긴다. 둘이 같은 가장자리를 두고 다투지 않게, 이 제스처는 기본
// 스와이프가 꺼진 동안에만 켠다.
// 화면은 손가락을 따라 움직이지 않고, 손을 뗐을 때 충분히 밀었으면 한 번 실행한다.
const EDGE_WIDTH = 25; // iOS 기본 가장자리 구역과 비슷한 폭
const TRIGGER_DISTANCE = 60;
const TRIGGER_VELOCITY = 500;

export default function EdgeSwipeBack({
  children,
  onBack,
  active = true,
  style,
}: {
  children: ReactNode;
  onBack: () => void;
  active?: boolean;
  style?: StyleProp<ViewStyle>; // 감싸는 화면의 바깥 View 스타일
}) {
  const navigation = useNavigation();
  const enabled = Platform.OS === "ios" && active;

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    navigation.setOptions({ gestureEnabled: false });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [enabled, navigation]);

  const gesture = Gesture.Pan()
    .enabled(enabled)
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
        <View collapsable={false} style={[styles.root, style]}>
          {children}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
