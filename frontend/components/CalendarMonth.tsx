import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppTypography";
import { BackIcon, ForwardIcon } from "./icons";
import { koreaCalendarDate } from "../utils/eventCalendar";

const COLORS = {
  surface: "#FFFFFF", border: "#E1E4E9", text: "#15171C",
  subtle: "#A6ACB7", primary: "#2761FF",
};
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function calendarMonthStyles(scale: number) {
  const r = (value: number) => value * scale;
  return StyleSheet.create({
    card: {
      borderRadius: r(12),
      backgroundColor: COLORS.surface,
      borderWidth: 0.5,
      borderColor: COLORS.border,
      padding: r(14),
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: r(10) },
    arrow: { width: r(24), height: r(24), alignItems: "center", justifyContent: "center" },
    month: { color: COLORS.text, fontSize: r(16), fontWeight: "600", lineHeight: r(19) },
    grid: { flexDirection: "row", flexWrap: "wrap", rowGap: r(2) },
    weekday: {
      width: "14.285%",
      color: COLORS.subtle,
      fontSize: r(11),
      fontWeight: "400",
      lineHeight: r(13),
      textAlign: "center",
      marginBottom: r(8),
    },
    weekdaySunday: { color: "#993556" },
    dayCell: { width: "14.285%", height: r(44), alignItems: "center", paddingTop: r(5) },
    // Android(Fabric)는 배경색이 나중에 붙는 뷰에서 borderRadius를 간헐적으로 놓친다.
    // 배경색과 radius를 항상 같은 스타일 객체에 두고 radius는 크기의 절반으로 고정한다.
    dayBadge: {
      width: r(24),
      height: r(24),
      borderRadius: r(12),
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    dayBadgeSelected: { backgroundColor: COLORS.primary, borderRadius: r(12) },
    dayBadgeToday: { backgroundColor: "#E6F1FB", borderRadius: r(12) },
    dayText: {
      color: COLORS.text,
      fontSize: r(13),
      fontWeight: "400",
      lineHeight: r(16),
      textAlign: "center",
      includeFontPadding: false,
    },
    dayTextSelected: { color: "#FFFFFF", fontWeight: "500" },
    dayTextToday: { color: "#0C447C", fontWeight: "500" },
    dayTextDisabled: { color: "#C7CBD2" },
    navigationDisabled: { opacity: 0.45 },
  });
}

type Props = {
  month: Date;
  selectedDay?: number;
  onChangeMonth: (delta: number) => void;
  onSelect: (date: Date) => void;
  isDateDisabled?: (date: Date) => boolean;
  nextDisabled?: boolean;
};

/** Home's month grid, without event dots, category filters or event content. */
export default function CalendarMonth({ month, selectedDay, onChangeMonth, onSelect, isDateDisabled, nextDisabled = false }: Props) {
  const [width, setWidth] = useState(320);
  const scale = Math.min(width / 320, 1.25);
  const cal = useMemo(() => calendarMonthStyles(scale), [scale]);
  const today = koreaCalendarDate();
  const todayDay = today.year === month.getFullYear() && today.month === month.getMonth() + 1 ? today.day : undefined;
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cellCount = Math.ceil((firstDay + lastDay) / 7) * 7;

  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={cal.card}>
      <View style={cal.header}>
        <Pressable accessibilityLabel="이전 달" onPress={() => onChangeMonth(-1)} style={cal.arrow}>
          <BackIcon size={16 * scale} color={COLORS.subtle} />
        </Pressable>
        <Text style={cal.month}>{`${month.getFullYear()}년 ${month.getMonth() + 1}월`}</Text>
        <Pressable accessibilityLabel="다음 달" accessibilityState={{ disabled: nextDisabled }} disabled={nextDisabled}
          onPress={() => onChangeMonth(1)} style={[cal.arrow, nextDisabled ? cal.navigationDisabled : null]}>
          <ForwardIcon size={16 * scale} color={COLORS.subtle} />
        </Pressable>
      </View>
      <View style={cal.grid}>
        {WEEKDAYS.map((day, index) => <Text key={day} style={[cal.weekday, index === 0 ? cal.weekdaySunday : null]}>{day}</Text>)}
        {Array.from({ length: cellCount }, (_, index) => {
          const day = index - firstDay + 1;
          if (day < 1 || day > lastDay) return <View key={`blank-${index}`} style={cal.dayCell} />;
          const date = new Date(month.getFullYear(), month.getMonth(), day);
          const disabled = isDateDisabled?.(date) ?? false;
          const selected = day === selectedDay;
          const isToday = day === todayDay;
          return (
            <Pressable key={day} accessibilityLabel={`${month.getFullYear()}년 ${month.getMonth() + 1}월 ${day}일`}
              accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => onSelect(date)} style={cal.dayCell}>
              <View style={[cal.dayBadge, selected ? cal.dayBadgeSelected : isToday ? cal.dayBadgeToday : null]}>
                <Text style={[cal.dayText, selected ? cal.dayTextSelected : isToday ? cal.dayTextToday : null, disabled ? cal.dayTextDisabled : null]}>{day}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
