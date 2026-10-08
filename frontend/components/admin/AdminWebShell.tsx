import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ComponentProps, ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../AppTypography";
import { requestWriteLeave } from "../../stores/writeLeaveGuard";

export type AdminNavItem = { key: string; label: string; icon: ComponentProps<typeof Ionicons>["name"] };
export default function AdminWebShell({ children, active, items, onNavigate, onExitMember, locked, nickname }: {
  children: ReactNode; active: string; items: AdminNavItem[]; onNavigate: (key: string) => void; onExitMember?: () => void; locked?: boolean; nickname?: string;
}) {
  const { width } = useWindowDimensions();
  if (Platform.OS !== "web") return <>{children}</>;
  const narrow = width < 768;
  return (
    <View style={[styles.shell, narrow && { flexDirection: "column" }]}>
      <View style={[styles.sidebar, { width: narrow ? "100%" : width >= 1280 ? 232 : 192 }, narrow && { borderRightWidth: 0, borderBottomWidth: 1 }]}>
        <View style={{ padding: 24, gap: 7 }}><Text style={{ fontSize: 18, fontWeight: "700", color: "#15171C" }}>AI·SW CAMPUS</Text><Text style={styles.muted}>관리자 콘솔</Text></View>
        <ScrollView horizontal={narrow} style={{ flex: narrow ? undefined : 1 }} contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 5 }}>
          {items.map((item) => (
            <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} aria-current={active === item.key ? "page" : undefined} accessibilityState={{ selected: active === item.key, disabled: !!locked }} disabled={locked}
              onPress={() => onNavigate(item.key)} style={[styles.nav, active === item.key && { backgroundColor: "#EDF2FE" }]}>
              <Ionicons name={item.icon} size={18} color={active === item.key ? "#2761FF" : "#15171C"} />
              <Text numberOfLines={1} style={{ color: active === item.key ? "#2761FF" : "#15171C", fontWeight: "600" }}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {!narrow && <View style={{ padding: 20, gap: 8 }}><Text style={{ color: "#15171C", fontWeight: "600" }}>{nickname || "관리자"}</Text><Pressable accessibilityRole="button" disabled={locked} onPress={() => { const proceed = onExitMember ?? (() => router.push("/(tabs)/home" as never)); if (!requestWriteLeave(proceed)) proceed(); }}><Text style={styles.muted}>회원 화면으로 이동 →</Text></Pressable></View>}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.header}><Text style={styles.muted}>관리자　 /　 <Text style={{ color: "#15171C", fontWeight: "600" }}>{items.find((item) => item.key === active)?.label ?? "메인"}</Text></Text></View>
        {children}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  shell: { flex: 1, flexDirection: "row", backgroundColor: "#FFFFFF" },
  sidebar: { borderRightWidth: 1, borderColor: "#E1E4E9", backgroundColor: "#FFFFFF" },
  muted: { color: "#6B7280", fontSize: 12 },
  nav: { minHeight: 44, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12 },
  header: { height: 64, borderBottomWidth: 1, borderColor: "#E1E4E9", paddingHorizontal: 24, justifyContent: "center", backgroundColor: "#FFFFFF" },
});
