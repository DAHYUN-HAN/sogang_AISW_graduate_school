import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "./AppTypography";

import { CheckCircleIcon } from "./icons";

type Props = {
  title: string;
  onConfirm: () => void;
  buttonLabel?: string;
};

export default function CompletionState({ title, onConfirm, buttonLabel = "확인" }: Props) {
  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <CheckCircleIcon size={64} />
        <Text style={styles.title}>{title}</Text>
        <Pressable accessibilityRole="button" onPress={onConfirm} style={styles.button}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 24,
  },
  title: {
    color: "#15171C",
    fontSize: 24,
    fontWeight: "500",
    lineHeight: 32,
    textAlign: "center",
  },
  button: {
    width: 280,
    maxWidth: "100%",
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#2761FF",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 24,
  },
});
