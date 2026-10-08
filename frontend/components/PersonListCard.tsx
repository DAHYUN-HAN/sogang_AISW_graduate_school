import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppTypography";

export default function PersonListCard({badge, name, caption, captionFirst = false, onPress, children, variant = "card"}: {
  badge: string; name: string; caption?: string; captionFirst?: boolean; onPress?: () => void; children?: ReactNode;
  variant?: "card" | "plain";
}) {
  const plain = variant === "plain";
  const content = <><View style={[styles.badge, plain && styles.plainBadge]}><Text style={[styles.badgeText, plain && styles.plainBadgeText]}>{badge || "—"}</Text></View>
    <View style={styles.text}>
      {captionFirst && caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={[styles.name, plain && styles.plainName]}>{name}</Text>
      {!captionFirst && caption ? <Text style={styles.caption}>{caption}</Text> : null}
      {children}
    </View></>;
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={[styles.card, plain && styles.plainRow]}>{content}</Pressable>
    : <View style={[styles.card, plain && styles.plainRow]}>{content}</View>;
}

const styles = StyleSheet.create({
  card: {minHeight: 68, flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1,
    borderColor: "#E1E4E9", backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10},
  badge: {width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#E6F1FB", marginRight: 12},
  badgeText: {color: "#0C447C", fontSize: 13, fontWeight: "500"}, text: {flex: 1, minWidth: 0, gap: 2},
  name: {color: "#15171C", fontSize: 15, fontWeight: "500"}, caption: {color: "#6B7280", fontSize: 13, lineHeight: 20},
  plainRow: {minHeight: 60, borderWidth: 0, borderRadius: 0, paddingHorizontal: 0, paddingVertical: 10, marginBottom: 0},
  plainBadge: {width: 36, height: 36, borderRadius: 18, backgroundColor: "#F0F2F4", marginRight: 10},
  plainBadgeText: {fontSize: 11, color: "#59616C"}, plainName: {fontSize: 14},
});
