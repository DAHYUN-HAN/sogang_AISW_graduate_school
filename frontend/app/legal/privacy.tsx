import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";

import LegalDocumentScreen from "../../components/LegalDocumentScreen";
import { useMeQuery } from "../../hooks/useApi";
import { useUserStore } from "../../stores/userStore";
import {
  createPrivacyConsentScreenDocument,
  PRIVACY_POLICY_SUPPORT_EMAIL,
} from "../../utils/privacyPolicy";

export default function PrivacyScreen() {
  const { data } = useMeQuery();
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const document = createPrivacyConsentScreenDocument(
    isAuthenticated && data ? data.data.privacy_consented_at ?? null : undefined,
  );
  return (
    <LegalDocumentScreen
      {...document}
      footer={
        <View style={styles.footer}>
          <Pressable
            accessibilityHint="계정 삭제 방법과 공개 삭제 요청 양식을 엽니다."
            accessibilityLabel="계정 및 데이터 삭제 안내"
            accessibilityRole="link"
            onPress={() => router.push("/legal/account-deletion")}
            style={({ pressed }) => [styles.deletionLink, pressed ? styles.deletionLinkPressed : null]}
          >
            <Text style={styles.deletionLinkTitle}>계정 및 데이터 삭제</Text>
            <Text style={styles.deletionLinkBody}>
              앱에 로그인할 수 없는 경우에도 웹에서 삭제를 요청할 수 있습니다.
            </Text>
          </Pressable>
          <Pressable
            accessibilityLabel="지원 및 문의 페이지"
            accessibilityRole="link"
            onPress={() => router.push("/legal/support")}
            style={({ pressed }) => [styles.deletionLink, pressed ? styles.deletionLinkPressed : null]}
          >
            <Text style={styles.deletionLinkTitle}>지원 및 개인정보 문의</Text>
            <Text style={styles.deletionLinkBody}>{PRIVACY_POLICY_SUPPORT_EMAIL}</Text>
          </Pressable>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { gap: 10 },
  deletionLink: {
    borderWidth: 1,
    borderColor: "#D8DEE9",
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    padding: 14,
    gap: 4,
  },
  deletionLinkPressed: { opacity: 0.7 },
  deletionLinkTitle: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  deletionLinkBody: { color: "#4B5563", fontSize: 12, lineHeight: 18 },
});
