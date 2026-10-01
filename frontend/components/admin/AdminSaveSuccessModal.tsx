import { Modal, Pressable } from "react-native";
import { AppText as Text } from "../AppTypography";

export default function AdminSaveSuccessModal({
  visible,
  title,
  message,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onConfirm}
    >
      <Pressable
        accessibilityLabel="등록 완료 닫기"
        onPress={onConfirm}
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
            {title}
          </Text>
          <Text style={{ color: "#4B5160", fontSize: 14, lineHeight: 22, textAlign: "center" }}>
            {message}
          </Text>
          <Pressable
            onPress={onConfirm}
            style={{
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 8,
              backgroundColor: "#2761FF",
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>확인</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
