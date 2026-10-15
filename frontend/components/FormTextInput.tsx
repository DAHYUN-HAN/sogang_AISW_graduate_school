import { useState, type ComponentProps } from "react";
import { Platform, ScrollView, StyleSheet, type TextStyle } from "react-native";

import { AppTextInput as TextInput } from "./AppTypography";
import { FIELD_BORDER } from "./FieldBorder";

// 글쓰기·글 수정 화면이 같이 쓰는 입력 칸. 여러 줄 칸은 내용에 따라 최소 높이에서
// 240까지 늘어나고, 그 뒤로는 칸 안에서 스크롤한다. 두 화면이 어긋나지 않게 한 곳에 둔다.
// Figma: 기본 0.5px #E1E4E9, 입력 중(포커스)과 오류는 1px 테두리
function FormTextInput({ style, hasError, onBlur, onFocus, ...props }: ComponentProps<typeof TextInput> & { hasError?: boolean }) {
  const [focused, setFocused] = useState(false);
  // 오류 테두리가 포커스 테두리를 이긴다. 값을 채우기 전까지는 눌러도 빨간색을
  // 유지해야 인증 화면과 감각이 같다.
  const inputStyle: TextStyle = StyleSheet.flatten([
    FIELD_BORDER.normal,
    style,
    focused ? styles.inputFocused : null,
    hasError ? styles.inputError : null,
  ]);
  const scrollableBody = props.multiline && Platform.OS === "android";
  const iosBody = props.multiline && Platform.OS === "ios";
  const maximumBodyHeight = 240;
  const borderWidth = inputStyle?.borderWidth ?? 0;
  const input = (
    <TextInput
      {...props}
      // Android uses a nested ScrollView for boundary handoff. iOS keeps its
      // native scrolling UITextView so text selection and caret reveal stay native.
      scrollEnabled={scrollableBody ? false : iosBody ? true : props.scrollEnabled}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      style={[
        inputStyle,
        scrollableBody ? {
          borderWidth: 0,
          borderRadius: 0,
          minHeight: typeof inputStyle?.minHeight === "number" ? Math.max(0, inputStyle.minHeight - borderWidth * 2) : inputStyle?.minHeight,
        } : null,
        iosBody ? { maxHeight: maximumBodyHeight } : null,
        { outlineStyle: "none" } as never,
      ]}
    />
  );
  if (!scrollableBody) return input;

  return (
    <ScrollView
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      bounces={false}
      style={{
        flexGrow: 0,
        width: inputStyle?.width,
        minHeight: inputStyle?.minHeight,
        maxHeight: maximumBodyHeight,
        borderWidth,
        borderColor: inputStyle?.borderColor,
        borderRadius: inputStyle?.borderRadius,
        backgroundColor: inputStyle?.backgroundColor,
      }}
    >
      {input}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  inputFocused: {
    ...FIELD_BORDER.focused, // 입력 칸 공통 원칙(FieldBorder)
  },
  inputError: {
    ...FIELD_BORDER.error, // 입력 칸 공통 원칙(FieldBorder)
  },
});

export default FormTextInput;
