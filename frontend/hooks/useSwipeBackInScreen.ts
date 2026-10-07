import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native";
import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

// 안드로이드 뒤로가기는 메뉴·검색창·상세 보기처럼 화면 안에 열린 것을 먼저 닫는다.
// iOS 가장자리 스와이프는 UIKit이 화면째 꺼내므로, 그런 것이 열려 있는 동안만 막고
// 같은 onBack을 태운다. usePreventRemove가 preventNativeDismiss를 켜 제스처가
// 시작되자마자 취소된다. 스와이프(POP)가 아닌 이동(삭제 후 이동, 저장 후 교체 등)은
// 막지 않고 그대로 보낸다.
export function useSwipeBackInScreen(active: boolean, onBack: () => void) {
  const navigation = useNavigation();
  const [passThrough, setPassThrough] = useState(false);
  const pendingAction = useRef<NavigationAction | null>(null);

  usePreventRemove(Platform.OS === "ios" && active && !passThrough, ({ data }) => {
    if (data.action.type === "POP") {
      onBack();
      return;
    }
    pendingAction.current = data.action;
    setPassThrough(true);
  });

  useEffect(() => {
    if (!passThrough) return;
    // 잠금이 풀린 렌더 뒤에 보낸다. 같은 틱에 보내면 아직 막힌 값으로 다시 걸린다.
    const action = pendingAction.current;
    pendingAction.current = null;
    if (action) navigation.dispatch(action);
    setPassThrough(false);
  }, [navigation, passThrough]);
}
