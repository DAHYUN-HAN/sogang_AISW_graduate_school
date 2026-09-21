import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ClubOperationStatus } from "../utils/participationGuide";

const OPTIONS: { value: ClubOperationStatus; label: string }[] = [
  { value: "active", label: "운영 중" },
  { value: "ended", label: "운영 종료" },
];

export default function ClubOperationStatusField({ value, onChange }: {
  value: ClubOperationStatus;
  onChange: (value: ClubOperationStatus) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>동아리 운영 상태</Text>
      <View style={styles.options}>
        {OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value }}
            onPress={() => onChange(option.value)}
            style={[styles.option, value === option.value && styles.selected]}
          >
            <Text style={[styles.optionText, value === option.value && styles.selectedText]}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.hint}>모집 마감 후에도 운영 중이면 활동인증을 작성할 수 있어요. 운영 종료 시 새 활동인증의 동아리 선택 목록에서 제외돼요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600", color: "#15171C" },
  options: { flexDirection: "row", gap: 8 },
  option: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 8 },
  selected: { borderColor: "#2761FF", backgroundColor: "#EDF2FE" },
  optionText: { fontSize: 14, color: "#6B7280" },
  selectedText: { color: "#2761FF", fontWeight: "600" },
  hint: { fontSize: 12, lineHeight: 18, color: "#6B7280" },
});
