import { createElement } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import { ActionButton, COLORS, EventDateTimePicker } from "./AdminControls";

export default function AdminBannerSchedule({ label, value, onChange, fallbackTime, disabled = false }: {
  label: string; value: string; onChange: (value: string) => void; fallbackTime: string; disabled?: boolean;
}) {
  const [date = "", time = fallbackTime] = value.split("T");
  return <View style={styles.container}>
    <View style={styles.header}>
      <Text style={styles.label}>{label}</Text>
      {value ? <ActionButton label={`${label} 해제`} tone="outline" disabled={disabled} onPress={() => {if (!disabled) onChange("");}} /> : <Text style={styles.muted}>제한 없음</Text>}
    </View>
    {Platform.OS === "web" ? <View style={styles.inputs}>
      <View style={{ flex: 1, minWidth: 140 }}>
        {createElement("input", {
          type: "date", "aria-label": `${label} 날짜`, value: date, min: "1000-01-01", max: "9999-12-31",
          disabled,
          onChange: (event: { target: { value: string } }) => {if (!disabled) onChange(event.target.value ? `${event.target.value}T${time}` : "");},
          style: inputStyle,
        })}
      </View>
      <View style={{ width: 115 }}>
        {createElement("input", {
          type: "time", "aria-label": `${label} 시간`, value: date ? time : "", step: 60, disabled: disabled || !date,
          onChange: (event: { target: { value: string } }) => {
            if (!disabled && date && event.target.value) onChange(`${date}T${event.target.value}`);
          },
          style: { ...inputStyle, backgroundColor: date ? "#FFFFFF" : "#F7F8FA" },
        })}
      </View>
    </View> : <EventDateTimePicker label={label} value={value} onChange={onChange} fallbackTime={fallbackTime} />}
  </View>;
}

const inputStyle = {
  boxSizing: "border-box" as const, width: "100%", minHeight: 44, padding: "10px 12px",
  border: "1px solid #E1E4E9", borderRadius: 8, backgroundColor: "#FFFFFF", color: "#15171C",
  fontFamily: "Pretendard-Regular, sans-serif", fontSize: 13, colorScheme: "light",
};
const styles = StyleSheet.create({
  container: { flex: 1, minWidth: 270, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40, gap: 10 },
  inputs: { flexDirection: "row", gap: 10 },
  label: { fontSize: 13, fontWeight: "500", color: COLORS.text },
  muted: { fontSize: 12, color: COLORS.muted },
});
