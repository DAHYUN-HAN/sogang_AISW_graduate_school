import { useState, type Ref } from "react";
import { StyleSheet, type TextInput, type TextInputProps } from "react-native";

import { AppTextInput } from "./AppTypography";

// 입력 칸 테두리 원칙(피그마). 바꿀 일이 생기면 여기 한 곳만 고친다.
// 평소 0.5 #E1E4E9 · 선택(입력 중) 1 #21262E · 오류 1 #D64545. 오류가 선택보다 우선한다.
// 0.5 → 1로 굵어져도 글자 위치는 보정하지 않는다(0.5px 차이라 눈에 띄지 않는다).
export const FIELD_ERROR_COLOR = "#D64545";
// 입력 칸 안내 문구(placeholder) 색. 피그마 글쓰기 화면 #A6ACB7.
export const FIELD_PLACEHOLDER_COLOR = "#A6ACB7";

export const FIELD_BORDER = StyleSheet.create({
  normal: { borderWidth: 0.5, borderColor: "#E1E4E9" },
  focused: { borderWidth: 1, borderColor: "#21262E" },
  error: { borderWidth: 1, borderColor: FIELD_ERROR_COLOR },
});

export function fieldBorder(focused: boolean, error?: boolean) {
  if (error) return FIELD_BORDER.error;
  return focused ? FIELD_BORDER.focused : FIELD_BORDER.normal;
}

type FocusHandler = NonNullable<TextInputProps["onFocus"]>;
type BlurHandler = NonNullable<TextInputProps["onBlur"]>;

// 입력 칸을 감싼 상자(아이콘·접미사가 같이 있는 칸)가 테두리를 그릴 때 쓴다.
// 안쪽 TextInput에 onFocus/onBlur를 넘기고, 상자 style에 fieldBorder(focused, error)를 준다.
export function useFieldFocus(handlers?: { onFocus?: FocusHandler; onBlur?: BlurHandler }) {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: ((event) => {
      setFocused(true);
      handlers?.onFocus?.(event);
    }) as FocusHandler,
    onBlur: ((event) => {
      setFocused(false);
      handlers?.onBlur?.(event);
    }) as BlurHandler,
  };
}

// 테두리를 직접 그리는 입력 칸. style에는 테두리 두께·색을 넣지 않는다.
export function FieldInput({ hasError, style, onFocus, onBlur, ...props }: TextInputProps & { hasError?: boolean; ref?: Ref<TextInput> }) {
  const focus = useFieldFocus({ onFocus, onBlur });
  return (
    <AppTextInput
      {...props}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      // 웹 브라우저 기본 포커스 테두리를 끄고 위 원칙만 보이게 한다.
      style={[style, fieldBorder(focus.focused, hasError), { outlineStyle: "none" } as never]}
    />
  );
}
