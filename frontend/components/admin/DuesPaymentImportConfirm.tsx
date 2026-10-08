import { Modal, Platform, Pressable, View } from "react-native";
import { AppText as Text } from "../AppTypography";

import { DUES_ADMIN_COLORS, DUES_ADMIN_WEB_COLORS } from "./DuesAdminPrimitives";


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
  const web = Platform.OS === "web";
  const COLORS = web ? DUES_ADMIN_WEB_COLORS : DUES_ADMIN_COLORS;
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="현재 학기 납부자 업로드 취소"
        onPress={onCancel}
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: web ? "rgba(17,24,39,0.25)" : "rgba(11,31,86,0.35)",
          paddingHorizontal: 24,
        }}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 420,
            borderRadius: web ? 8 : 12,
            backgroundColor: COLORS.surface,
            padding: 22,
            gap: 16,
            shadowColor: "#000000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: web ? 0 : 0.12,
            shadowRadius: 24,
            elevation: 12,
            ...(web ? { borderWidth: 1, borderColor: COLORS.border, padding: 24 } : {}),
          }}
        >
          <View style={{ gap: 7 }}>
            <Text style={{ color: COLORS.primary900, fontSize: web ? 18 : 19, fontWeight: web ? "600" : "900", textAlign: web ? "left" : "center" }}>
              현재 학기 납부자 교체
            </Text>
            <Text style={{ color: COLORS.text, fontSize: web ? 13 : 14, lineHeight: 21, textAlign: web ? "left" : "center" }}>
              업로드하면 기존 전체 납부와 특정 행사 1회 납부가 모두 초기화됩니다.
            </Text>
            <Text style={{ color: COLORS.error, fontSize: web ? 12 : 13, lineHeight: 19, textAlign: web ? "left" : "center" }}>
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
                borderRadius: web ? 6 : 8,
                backgroundColor: web ? COLORS.surface : COLORS.surfaceAlt,
                opacity: disabled ? 0.55 : 1,
                ...(web ? { borderWidth: 1, borderColor: COLORS.border } : {}),
              }}
            >
              <Text style={{ color: COLORS.text, fontSize: web ? 13 : 15, fontWeight: web ? "400" : "800" }}>취소</Text>
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
                borderRadius: web ? 6 : 8,
                backgroundColor: COLORS.error,
                opacity: disabled ? 0.55 : 1,
              }}
            >
              <Text style={{ color: COLORS.surface, fontSize: web ? 13 : 15, fontWeight: web ? "600" : "900" }}>엑셀 선택</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
