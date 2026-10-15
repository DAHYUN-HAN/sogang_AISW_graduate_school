import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "./AppTypography";
import { privacyConsentSheetSections } from "../utils/privacyPolicy";
import { BUTTON_TEXT } from "../utils/buttonText";

// 계정 설정의 "개인정보 수집 및 이용 동의"를 누르면 아래에서 올라오는 시트.
// 피그마 Screen/MyPage/PrivacyConsentSheet.
const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  body: "#4A5261",
  handle: "#D1D6DB",
  bg: "#FFFFFF",
};

const SHEET_BOTTOM_PADDING = 20;
// "제1조 (목적)"처럼 조항이면 13, 문서·장 제목이면 14로 한 단계 크게 보인다.
const ARTICLE_TITLE = /^제\s*\d+\s*조/;

export default function PrivacyConsentSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const sections = privacyConsentSheetSections();
  return (
    // 안드로이드 시스템 바 아래까지 그려 시트가 화면 끝에 붙게 한다(SelectionSheet와 같다).
    <Modal animationType="slide" transparent statusBarTranslucent navigationBarTranslucent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* 바깥 누르기는 카드 뒤에 깐 형제 Pressable이 받는다. 카드를 Pressable로 감싸면
            카드가 터치를 먼저 잡아, 천천히 끄는 스크롤이 본문 ScrollView로 넘어가지 않는다. */}
        <Pressable accessibilityLabel="닫기" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>이용약관 및 개인정보 처리방침</Text>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {sections.map((section, index) => {
              const article = ARTICLE_TITLE.test(section.title);
              return (
                <View key={`${section.title}-${index}`} style={styles.section}>
                  <Text style={article ? styles.articleTitle : styles.heading}>{section.title}</Text>
                  {section.body ? <Text style={styles.body}>{section.body}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, SHEET_BOTTOM_PADDING) }]}>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>닫기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(17, 24, 39, 0.42)" },
  // Figma: 360x640 시트. 작은 화면에서는 위를 조금 남긴다.
  card: { width: "100%", maxWidth: 405, height: 640, maxHeight: "90%", borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: COLORS.bg },
  handleWrap: { height: 22, alignItems: "center", paddingTop: 10 }, // Figma 핸들래퍼 22, 막대 y10
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: COLORS.handle },
  // Figma 헤더 36: 제목 17 SemiBold, 위 4
  title: { height: 36, paddingTop: 4, paddingHorizontal: 20, color: COLORS.text, fontSize: 17, lineHeight: 20, fontWeight: "600" },
  scroll: { flex: 1 },
  // Figma 본문: 위 4, 블록 사이 14, 제목과 본문 사이 4
  content: { paddingTop: 4, paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  section: { gap: 4 },
  heading: { color: COLORS.text, fontSize: 14, lineHeight: 17, fontWeight: "600" },
  articleTitle: { color: COLORS.text, fontSize: 13, lineHeight: 16, fontWeight: "600" },
  body: { color: COLORS.body, fontSize: 13, lineHeight: 20, fontWeight: "400" },
  // Figma 닫기래퍼: 위 12, 버튼 46(r10), 아래 20
  footer: { paddingTop: 12, paddingHorizontal: 20 },
  closeButton: { height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.primary },
  closeText: { ...BUTTON_TEXT, color: "#FFFFFF", fontWeight: "600" },
});
