import { usePreventRemove } from "@react-navigation/native";
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

import { useMyPageDrawer } from "../components/MyPageDrawer";
import {
  handleMyPageHardwareBack,
  type MyPageDrawerSettingsRoute,
  myPageSettingsBackHandler,
} from "../utils/myPageNavigation";

// native-stack이 화면 전환을 마치면 보내는 이벤트. 기본 이벤트 타입에는 없어 직접 적는다.
type TransitionEndListener = {
  addListener: (type: "transitionEnd", callback: (event: { data?: { closing?: boolean } }) => void) => () => void;
};

// 이벤트가 끝내 오지 않아도 서랍이 화면을 계속 덮고 있지 않게 하는 상한.
const APPEAR_FALLBACK_MS = 600;

export function useReturnToMyPageDrawer(route: MyPageDrawerSettingsRoute) {
  const { returnToDrawer, settingsDidLayout } = useMyPageDrawer();
  const navigation = useNavigation();
  const hasLaidOut = useRef(false);
  // 이 화면들은 탭 스택 위에 push 된다. 탭 전환과 달리 네이티브가 새 화면을 실제로
  // 붙이는 시점이 JS 배치보다 늦어서, 배치만 보고 서랍을 걷으면 아래 탭 화면이 한 번
  // 비친다. 전환이 끝났다는 신호까지 기다린다. 웹은 네이티브 전환이 없어 기다리지 않는다.
  const hasAppeared = useRef(Platform.OS === "web");
  const readyFrame = useRef<number | null>(null);
  const returnFromScreen = myPageSettingsBackHandler(route, returnToDrawer);
  const cancelReady = useCallback(() => {
    if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
    readyFrame.current = null;
  }, []);
  const revealWhenPainted = useCallback(() => {
    cancelReady();
    if (!navigation.isFocused()) return;
    // Layout/focus can precede the native tab's presentation. Leave a frame for
    // that commit to paint before removing the covering Android window.
    readyFrame.current = requestAnimationFrame(() => {
      readyFrame.current = requestAnimationFrame(() => {
        readyFrame.current = null;
        if (navigation.isFocused()) settingsDidLayout(route);
      });
    });
  }, [cancelReady, navigation, route, settingsDidLayout]);
  const markAppeared = useCallback(() => {
    if (hasAppeared.current) return;
    hasAppeared.current = true;
    if (hasLaidOut.current) revealWhenPainted();
  }, [revealWhenPainted]);
  useEffect(() => (navigation as unknown as TransitionEndListener).addListener("transitionEnd", (event) => {
    if (!event.data?.closing) markAppeared();
  }), [markAppeared, navigation]);
  const onLayout = useCallback(() => {
    hasLaidOut.current = true;
    if (hasAppeared.current) {
      revealWhenPainted();
      return;
    }
    setTimeout(markAppeared, APPEAR_FALLBACK_MS);
  }, [markAppeared, revealWhenPainted]);
  // 이 화면들의 "뒤로"는 스택 pop이 아니라 서랍으로 덮은 뒤 원래 탭으로 가는
  // 별도 전환이다. iOS 가장자리 스와이프는 UIKit이 그냥 pop 해버려 설정 목록으로
  // 떨어지므로, 그 pop을 막고 헤더·안드로이드와 같은 복귀를 태운다.
  usePreventRemove(true, () => returnFromScreen());

  useFocusEffect(
    useCallback(() => {
      // Retained settings screens may focus again without another layout event.
      if (hasLaidOut.current && hasAppeared.current) revealWhenPainted();
      const subscription = Platform.OS === "android" ? BackHandler.addEventListener(
        "hardwareBackPress",
        () => handleMyPageHardwareBack(returnFromScreen),
      ) : undefined;
      return () => {
        cancelReady();
        subscription?.remove();
      };
    }, [cancelReady, returnFromScreen, revealWhenPainted]),
  );
  return { returnToMyPageDrawer: returnFromScreen, onLayout };
}
