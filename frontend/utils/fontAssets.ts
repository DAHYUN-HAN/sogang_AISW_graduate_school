// Only the root font loader needs the binary assets. Text style resolution stays
// independent of asset loading and uses the same family aliases on every platform.
export const APP_FONTS = {
  Pretendard_400Regular: require("../assets/fonts/Pretendard-Regular.otf"),
  Pretendard_500Medium: require("../assets/fonts/Pretendard-Medium.otf"),
  Pretendard_600SemiBold: require("../assets/fonts/Pretendard-SemiBold.otf"),
  Pretendard_700Bold: require("../assets/fonts/Pretendard-Bold.otf"),
  Pretendard_800ExtraBold: require("../assets/fonts/Pretendard-ExtraBold.otf"),
  Pretendard_900Black: require("../assets/fonts/Pretendard-Black.otf"),
};
