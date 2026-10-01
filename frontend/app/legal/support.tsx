import { router } from "expo-router";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";

import LegalDocumentScreen from "../../components/LegalDocumentScreen";

const OPERATOR_NAME = process.env.EXPO_PUBLIC_OPERATOR_NAME?.trim() || "운영 주체 승인 필요";
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL?.trim() || "";

const SECTIONS = [
  {
    title: "서비스 지원",
    body:
      "로그인, 이메일 인증, 게시물·첨부파일, 알림, 신고와 앱 이용 중 발생한 문제를 문의할 수 있습니다. 문제 화면, 발생 시각, 기기 OS와 재현 절차를 함께 보내면 확인에 도움이 됩니다. 비밀번호와 인증 코드는 보내지 마세요.",
  },
  {
    title: "계정 및 개인정보",
    body:
      "개인정보 열람·정정·삭제 또는 계정 삭제 처리에 관한 문의를 접수합니다. 계정 삭제는 앱 설정 또는 공개 계정 삭제 페이지에서 직접 요청할 수 있습니다.",
  },
  {
    title: "운영 주체",
    body: OPERATOR_NAME,
  },
  {
    title: "지원 이메일",
    body: SUPPORT_EMAIL || "출시 전 지원 이메일을 설정해야 합니다.",
  },
];

export default function SupportScreen() {
  return (
    <LegalDocumentScreen
      title="지원 및 문의"
      sections={SECTIONS}
      footer={
        <View style={styles.footer}>
          <Pressable
            accessibilityRole="button"
            disabled={!SUPPORT_EMAIL}
            onPress={() => void Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
            style={[styles.primaryButton, !SUPPORT_EMAIL ? styles.disabled : null]}
          >
            <Text style={styles.primaryButtonText}>이메일로 문의하기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/legal/privacy")}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>개인정보 처리 안내</Text>
          </Pressable>
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push("/legal/account-deletion")}
            style={styles.linkButton}
          >
            <Text style={styles.linkText}>계정 및 데이터 삭제</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#2761FF",
    paddingHorizontal: 16,
  },
  disabled: { backgroundColor: "#A6ACB7" },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  linkButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  linkText: { color: "#2761FF", fontSize: 13, fontWeight: "600" },
});
