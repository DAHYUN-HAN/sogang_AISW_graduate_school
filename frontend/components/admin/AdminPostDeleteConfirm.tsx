import { Modal, Pressable, View } from "react-native";
import { AppText as Text } from "../AppTypography";

export default function AdminPostDeleteConfirm({
  visible,
  deleting,
  error,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  deleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onCancel}
    >
      <Pressable
        accessibilityLabel="게시물 삭제 닫기"
        onPress={onCancel}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          paddingHorizontal: 28,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 280,
            borderRadius: 16,
            backgroundColor: "#FFFFFF",
            padding: 24,
            gap: 16,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <Text style={{ color: "#111827", fontSize: 18, fontWeight: "500", lineHeight: 26, textAlign: "center" }}>
            게시물 삭제
          </Text>
          <Text style={{ color: "#4B5160", fontSize: 14, lineHeight: 22, textAlign: "center" }}>
            삭제한 게시물은 복구할 수 없어요.{"\n"}작성한 댓글도 함께 삭제돼요.
          </Text>
          {error ? (
            <Text accessibilityRole="alert" style={{ color: "#D94343", fontSize: 13, lineHeight: 19, textAlign: "center" }}>
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              disabled={deleting}
              onPress={onCancel}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: "#F3F4F6",
                opacity: deleting ? 0.55 : 1,
              }}
            >
              <Text style={{ color: "#374151", fontSize: 15, fontWeight: "700" }}>취소</Text>
            </Pressable>
            <Pressable
              disabled={deleting}
              onPress={onConfirm}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: "#D94343",
                opacity: deleting ? 0.55 : 1,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>
                {deleting ? "삭제 중" : "삭제"}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
