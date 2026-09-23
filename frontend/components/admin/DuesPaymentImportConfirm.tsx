import { Modal, Pressable, Text, View } from "react-native";

import { DUES_ADMIN_COLORS as COLORS } from "./DuesAdminPrimitives";


export default function DuesPaymentImportConfirm({
  visible,
  disabled,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="현재 학기 납부자 업로드 취소"
        onPress={onCancel}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(11,31,86,0.35)",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: 12,
            backgroundColor: COLORS.surface,
            padding: 22,
            gap: 16,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
            elevation: 12,
          }}
        >
          <View style={{ gap: 7 }}>
            <Text style={{ color: COLORS.primary900, fontSize: 19, fontWeight: "900", textAlign: "center" }}>
              현재 학기 납부자 교체
            </Text>
            <Text style={{ color: COLORS.text, fontSize: 14, lineHeight: 21, textAlign: "center" }}>
              업로드하면 기존 전체 납부와 특정 행사 1회 납부가 모두 초기화됩니다.
            </Text>
            <Text style={{ color: COLORS.error, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
              파일 검증에 실패하면 기존 납부 상태는 유지됩니다.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onCancel}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: COLORS.surfaceAlt,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "800" }}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={disabled}
              onPress={onConfirm}
              style={{
                flex: 1,
                minHeight: 44,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                backgroundColor: COLORS.error,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text style={{ color: COLORS.surface, fontSize: 15, fontWeight: "900" }}>엑셀 선택</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
