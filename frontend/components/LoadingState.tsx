import { ActivityIndicator, type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { AppText as Text } from "./AppTypography";

type Props = {
  message?: string;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function LoadingState({ message = "불러오는 중이에요", compact = false, style }: Props) {
  return (
    <View accessibilityLabel={message} accessibilityRole="progressbar" style={[styles.container, compact ? styles.compact : null, style]}>
      <ActivityIndicator color="#2761FF" size={32} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
  },
  compact: {
    flex: 0,
    minHeight: 160,
  },
  message: {
    color: "#8A919C",
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 18,
  },
});
