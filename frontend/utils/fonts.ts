import type { TextStyle } from "react-native";

// Pretendard: 라틴은 Inter 기반, 한글은 Apple SD Gothic Neo와 같은 메트릭이라
// 피그마 시안(Inter + Mac 한글 폴백)과 같은 모습을 모든 플랫폼에서 재현한다.
// The app styles text with numeric fontWeight everywhere (400~900). Each static
// Pretendard face embeds a single weight, so we map fontWeight -> the matching family.
const WEIGHT_TO_FAMILY: Record<string, string> = {
  "100": "Pretendard_400Regular",
  "200": "Pretendard_400Regular",
  "300": "Pretendard_400Regular",
  "400": "Pretendard_400Regular",
  normal: "Pretendard_400Regular",
  "500": "Pretendard_500Medium",
  "600": "Pretendard_600SemiBold",
  "700": "Pretendard_700Bold",
  bold: "Pretendard_700Bold",
  "800": "Pretendard_800ExtraBold",
  "900": "Pretendard_900Black",
};

const APP_FONT_FAMILIES = new Set(Object.values(WEIGHT_TO_FAMILY));

export function isAppFontFamily(family: string | undefined): boolean {
  return family !== undefined && APP_FONT_FAMILIES.has(family);
}

export function appFontStyle(weight?: TextStyle["fontWeight"]): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  return {
    fontFamily: WEIGHT_TO_FAMILY[String(weight ?? "400")] ?? "Pretendard_400Regular",
    // Each file is a complete static face. Requesting another weight can cause
    // synthetic bold on web or select a different typeface on native.
    fontWeight: "normal",
  };
}

export function applyWebFontSmoothing(): void {
  // 피그마는 antialiased로 렌더링한다. 브라우저 기본(subpixel)은 같은 폰트도
  // 더 두껍고 진해 보여서, 웹 렌더링을 피그마와 동일하게 맞춘다.
  if (typeof document === "undefined") return;
  if (document.getElementById("font-smoothing-patch")) return;
  const style = document.createElement("style");
  style.id = "font-smoothing-patch";
  style.textContent = "*{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;}";
  document.head.appendChild(style);
}
