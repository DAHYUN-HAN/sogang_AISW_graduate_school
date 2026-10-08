import type { ReactNode } from "react";
import { Platform, ScrollView, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../AppTypography";

export default function AdminPageFrame({ title, children }: { title: string; children: ReactNode }) {
  const { width } = useWindowDimensions();
  return <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: "#FFFFFF" }} contentContainerStyle={{ padding: Platform.OS === "web" && width >= 1280 ? 28 : 20, paddingBottom: 48 }}>
    <Text accessibilityRole="header" style={{ color: "#15171C", fontSize: 24, fontWeight: "600", marginBottom: 28 }}>{title}</Text>
    <View style={{ gap: 20, minWidth: 0 }}>{children}</View>
  </ScrollView>;
}
