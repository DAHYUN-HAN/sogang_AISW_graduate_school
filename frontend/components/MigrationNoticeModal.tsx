import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

// Figma: Screen/Common/MigrationNoticeModal-TextOnly (1329:45)
// 카드 300x196, 안쪽 여백 24/20/20, 블록 사이 10. ×는 카드 위 오른쪽,
// "다시 보지 않기"는 카드 아래 가운데.
const COLORS = {
  surface: "#FFFFFF",
  title: "#15171C",
  body: "#6B7280",
  primary: "#2761FF",
};

type Props = {
  visible: boolean;
  /** ×와 배경 탭. 이번 실행에서만 닫는다. */
  onClose: () => void;
  onRegister: () => void;
  onHideForever: () => void;
};

export default function MigrationNoticeModal({ visible, onClose, onRegister, onHideForever }: Props) {
  return (
    <Modal animationType="fade" transparent statusBarTranslucent navigationBarTranslucent visible={visible} onRequestClose={onClose}>
      <Pressable accessibilityLabel="안내 닫기" onPress={onClose} style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.stack}>
          <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose} style={styles.closeRow}>
            <Text style={styles.closeMark}>×</Text>
          </Pressable>

          <Pressable onPress={() => undefined} style={styles.card}>
            <Text accessibilityRole="header" style={styles.title}>새로워진 AI·SW CAMPUS를 만나보세요</Text>
            <Text style={styles.body}>{"기존 앱 사용자도 새로 가입이 필요해요.\n학교 이메일로 30초면 끝!"}</Text>
            <Pressable accessibilityRole="button" onPress={onRegister} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>회원가입 하러 가기</Text>
            </Pressable>
          </Pressable>

          <Pressable accessibilityRole="button" hitSlop={8} onPress={onHideForever}>
            <Text style={styles.hideForever}>다시 보지 않기</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const CARD_WIDTH = 300;

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    // Figma는 뒤에 아무것도 없는 프레임에 rgba(0,0,0,0.5)를 깔아 통회색이다.
    // 반투명으로 두면 로그인 화면이 비쳐 보이므로, 흰 바탕에 합성한 값을 그대로 칠한다.
    backgroundColor: "#808080",
    paddingHorizontal: 30, // Figma: 360 - 300 카드 / 2
  },
  stack: {
    width: "100%",
    maxWidth: CARD_WIDTH,
    alignItems: "center",
  },
  closeRow: {
    alignSelf: "flex-end",
    // Figma에서 ×의 글자 상자가 카드 오른쪽 끝보다 8 바깥으로 나간다.
    marginRight: -8,
    marginBottom: 9,
  },
  closeMark: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "400",
    lineHeight: 33,
  },
  card: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    overflow: "hidden",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    gap: 10,
  },
  title: {
    color: COLORS.title,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 21,
    textAlign: "center",
  },
  body: {
    color: COLORS.body,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 21, // Figma: 14/150%
    textAlign: "center",
  },
  primaryButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    lineHeight: 18,
  },
  hideForever: {
    color: "rgba(255, 255, 255, 0.85)",
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17,
    marginTop: 18,
    textAlign: "center",
  },
});
