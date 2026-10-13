import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { Animated, BackHandler, Platform, StyleSheet, useWindowDimensions } from "react-native";

import { MyPageContent } from "../app/(tabs)/(home,notices,community,participation,council)/settings/index";
import { useUserStore } from "../stores/userStore";
import EdgeSwipeBack from "./EdgeSwipeBack";

// 홈의 마이페이지 서랍. 홈 화면 안에 그려서, 홈은 그대로 멈춰 있고 마이페이지가 왼쪽에서
// 덮으며 들어온다.
// 하위 화면(프로필·내가 쓴 글·알림 설정·계정 설정)으로 갈 때도 서랍을 닫지 않는다. 하위
// 화면은 홈 탭 스택에 쌓여 홈과 이 서랍을 함께 덮으므로, iOS 기본 스와이프·안드로이드
// 뒤로가기로 pop 하면 열려 있던 서랍이 그대로 보인다. 예전 서랍은 이동할 때 닫았다가
// 돌아올 때 다시 열고 그 사이를 usePreventRemove로 막아서 iOS에서 튕겼다(PLAN.md 2026-10-13).
const OPEN_DURATION = 210;
const CLOSE_DURATION = 180;

export default function MyPageDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { width } = useWindowDimensions();
  const translateX = useRef(new Animated.Value(-width)).current;
  const closing = useRef(false);
  const navigation = useNavigation();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!open) return;
    closing.current = false;
    translateX.setValue(-width);
    Animated.timing(translateX, { toValue: 0, duration: OPEN_DURATION, useNativeDriver: true }).start();
    // 열릴 때만 들어온다. 화면 폭이 바뀌어도 다시 미끄러져 들어오지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, translateX]);

  // 헤더 뒤로가기, 안드로이드 뒤로가기, iOS 왼쪽 가장자리 스와이프, 홈 탭 다시 누르기가
  // 모두 왼쪽으로 빠져나가며 닫는다.
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(translateX, { toValue: -width, duration: CLOSE_DURATION, useNativeDriver: true }).start(() => onClose());
  }, [onClose, translateX, width]);

  // 로그아웃하면 바로 닫아, 다시 로그인했을 때 서랍이 열린 채로 남지 않게 한다.
  useEffect(() => {
    if (open && !isAuthenticated) onClose();
  }, [isAuthenticated, onClose, open]);

  useFocusEffect(
    useCallback(() => {
      if (!open || Platform.OS !== "android") return undefined;
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        close();
        return true;
      });
      return () => subscription.remove();
    }, [close, open]),
  );

  useEffect(() => {
    if (!open) return undefined;
    const tabStack = navigation.getParent();
    if (!tabStack) return undefined;
    const unsubscribePress = tabStack.addListener("tabPress" as never, () => {
      // 홈을 보고 있을 때 홈 탭을 누르면 닫는다.
      if (navigation.isFocused()) close();
    });
    // 다른 탭으로 가면 그 자리에서 닫아 둔다. 뒤로가기로 홈 탭에 돌아오면 홈이 보인다.
    // 하위 화면 push는 홈 탭 안의 이동이라 이 blur가 오지 않는다.
    const unsubscribeBlur = tabStack.addListener("blur", () => onClose());
    return () => {
      unsubscribePress();
      unsubscribeBlur();
    };
  }, [close, navigation, onClose, open]);

  if (!open) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.drawer, { transform: [{ translateX }] }]}>
      <EdgeSwipeBack active onBack={close}>
        <MyPageContent onBack={close} />
      </EdgeSwipeBack>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    backgroundColor: "#FFFFFF",
  },
});
