import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackIcon } from "./icons";
type LegalSection = { title: string; body: string };

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

function formatConsentDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const base = `${String(date.getFullYear()).slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
  return `${base}(${WEEKDAYS[date.getDay()]})`;
}

export default function LegalDocumentScreen({
  title,
  effectiveDate,
  version,
  sections,
  consentDate,
  footer,
}: {
  title: string;
  effectiveDate?: string;
  version?: string;
  sections: LegalSection[];
  consentDate?: string | null;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const consentLabel = formatConsentDate(consentDate);
  const showConsent = Boolean(consentLabel);
  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable accessibilityLabel="뒤로" onPress={() => (router.canGoBack() ? router.back() : router.replace("/auth/login"))} style={styles.iconButton}>
          <BackIcon size={24} color="#15171C" />
        </Pressable>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {effectiveDate || version ? (
          <View style={styles.policyMeta}>
            {effectiveDate ? <Text style={styles.effective}>시행일: {effectiveDate}</Text> : null}
            {version ? <Text style={styles.effective}>버전: {version}</Text> : null}
          </View>
        ) : null}
        {showConsent ? (
          <View style={styles.consentRow}>
            <Ionicons name="checkmark-circle" size={14} color="#2E9E5B" />
            <Text style={styles.consentText}>{consentLabel} 동의 완료</Text>
          </View>
        ) : null}
        {sections.map((section, index) => (
          <View key={`${section.title}-${index}`} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FFFFFF" },
  header: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 14 },
  iconButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#15171C", fontSize: 17, fontWeight: "500" },
  content: { paddingTop: 12, paddingHorizontal: 16, paddingBottom: 48, gap: 16 },
  effective: { color: "#6B7280", fontSize: 13, fontWeight: "400" },
  policyMeta: { gap: 4 },
  consentRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  consentText: { color: "#2E9E5B", fontSize: 13, fontWeight: "500" },
  section: { gap: 3 },
  sectionTitle: { color: "#15171C", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  body: { color: "#15171C", fontSize: 13, fontWeight: "400", lineHeight: 19 },
});
