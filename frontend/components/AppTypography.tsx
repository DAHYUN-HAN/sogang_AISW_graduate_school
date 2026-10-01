import { createContext, useContext, type Ref } from "react";
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from "react-native";

import { appFontStyle, isAppFontFamily } from "../utils/fonts";

type TextFont = Pick<TextStyle, "fontFamily" | "fontWeight">;
const TextFontContext = createContext<TextFont>({});

function resolveFont(style: TextStyle, inherited: TextFont = {}) {
  const fontFamily = style.fontFamily ?? inherited.fontFamily;
  const fontWeight = style.fontWeight ?? inherited.fontWeight;
  const isAppFace = isAppFontFamily(fontFamily);
  const font: TextFont = fontFamily
    ? { fontFamily, fontWeight: isAppFace ? "normal" : fontWeight }
    : appFontStyle(fontWeight);
  // Keep the logical weight for child Text elements. The native style is normal
  // because the selected static file already contains that weight's glyphs.
  const context: TextFont = isAppFace
    ? { fontWeight: fontFamily!.slice("Pretendard_".length, "Pretendard_".length + 3) as TextStyle["fontWeight"] }
    : { fontFamily, fontWeight };
  return { font, context };
}

// Export the native instance types too, so useRef<TextInput> continues to expose
// focus(), blur() and the other native methods when imports use local aliases.
export type AppText = NativeText;
export type AppTextInput = NativeTextInput;

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Value and native instance type intentionally share the public name.
export function AppText({ style, children, ...props }: TextProps & { ref?: Ref<NativeText> }) {
  const inherited = useContext(TextFontContext);
  const flattened = StyleSheet.flatten(style) ?? {};
  const { font, context } = resolveFont(flattened, inherited);
  return (
    <TextFontContext.Provider value={context}>
      <NativeText {...props} style={{ ...flattened, ...font }}>{children}</NativeText>
    </TextFontContext.Provider>
  );
}

// eslint-disable-next-line @typescript-eslint/no-redeclare -- Preserve the native instance type for existing ref consumers.
export function AppTextInput({ style, ...props }: TextInputProps & { ref?: Ref<NativeTextInput> }) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const { font } = resolveFont(flattened);
  return <NativeTextInput {...props} style={{ ...flattened, ...font }} />;
}
