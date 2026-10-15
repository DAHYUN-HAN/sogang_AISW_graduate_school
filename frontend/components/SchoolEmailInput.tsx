import { useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "./AppTypography";
import { fieldBorder } from "./FieldBorder";

type Props = {
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  hasError?: boolean;
  // 기본 44(로그인·회원가입 피그마). 비밀번호 찾기는 피그마가 48이라 따로 넘긴다.
  height?: number;
};

export const SCHOOL_EMAIL_DOMAIN = "@sogang.ac.kr";

export default function SchoolEmailInput({ value, onChangeText, placeholder = "이메일 ID", hasError = false, height }: Props) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={[styles.container, height ? { minHeight: height } : null]}>
      <TextInput
        autoCapitalize="none"
        autoCorrect={false}
        inputMode={Platform.OS === "web" ? "text" : "email"}
        keyboardType={Platform.OS === "web" ? "default" : "email-address"}
        maxLength={64}
        onBlur={() => setIsFocused(false)}
        onChangeText={(next) => onChangeText(next.replace(/@.*$/, "").replace(/\s/g, ""))}
        onFocus={() => setIsFocused(true)}
        placeholder={placeholder}
        placeholderTextColor="#A6ACB7"
        style={[styles.input, { outlineStyle: "none" } as never]}
        value={value}
      />
      <View style={styles.divider} />
      <View style={styles.domainBox}>
        <Text style={styles.domain}>{SCHOOL_EMAIL_DOMAIN}</Text>
      </View>
      {/*
        테두리는 자식 위에 따로 그린다. 컨테이너에 borderWidth를 주면 iOS가 자식을
        테두리 '바깥쪽' 반경으로 잘라, 모서리에서 테두리 호와 잘린 자식 배경의 호가
        따로 보인다(0.5px라 안티앨리어싱까지 겹쳐 선이 두 겹으로 읽힌다). 위에 덮어
        그리면 그 경계를 테두리가 가려 호가 하나만 남는다.
      */}
      <View
        pointerEvents="none"
        style={[styles.border, fieldBorder(isFocused, hasError)]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 44, // Figma: h-44
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  // 두께·색은 입력 칸 공통 원칙(FieldBorder)을 따른다.
  border: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: "#15171C",
    fontSize: 14,
    fontWeight: "400", // Figma: Inter Regular
    paddingLeft: 14, // Figma: padding 12px 8px 12px 14px
    paddingRight: 8,
  },
  divider: {
    width: 1,
    backgroundColor: "#E1E4E9",
  },
  domainBox: {
    width: 130,
    justifyContent: "center",
    paddingLeft: 10,
    paddingRight: 14,
    backgroundColor: "#F5F5F5",
  },
  domain: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "400", // Figma: Inter Regular
  },
});
