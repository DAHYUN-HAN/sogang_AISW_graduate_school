import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { STATUS_BAR_SCRIM_COLOR, statusBarScrimHeight } from "../utils/statusBarScrim";

// edge-to-edge 화면에서는 상태바 배경이 완전 투명이라 스크롤 콘텍츠가 시계·배터리 아이콘 뒤로 그대로 비친다.
// 상태바 높이만큼 화면 배경색 막을 덧대 콘텐츠와 상태바를 분리한다. 터치는 통과시킨다.
export default function StatusBarScrim() {
  const insets = useSafeAreaInsets();
  const height = statusBarScrimHeight(insets.top, Platform.OS, StatusBar.currentHeight);
  if (height <= 0) {
    return null;
  }
  return <View pointerEvents="none" style={[styles.scrim, { height }]} />;
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    // Android는 네이티브 스택 화면이 형제 뷰 위에 그려지므로 elevation으로 z-order를 확보한다.
    // elevation이 만드는 그림자는 디자인에 없으므로 투명으로 지운다(상태바 아래 회색 띠 방지).
    elevation: 100,
    shadowColor: "transparent",
    backgroundColor: STATUS_BAR_SCRIM_COLOR,
  },
});
