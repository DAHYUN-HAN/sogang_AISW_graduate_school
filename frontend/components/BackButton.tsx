import { router } from "expo-router";
import { Pressable } from "react-native";
import { AppText as Text } from "./AppTypography";

import { BackIcon } from "./icons";
import { replaceWithRoute } from "../utils/tabNavigation";
type Props = {
  fallback?: string;
  label?: string;
};

export default function BackButton({ fallback = "/(tabs)/home", label = "뒤로" }: Props) {
  return (
    <Pressable
      hitSlop={8}
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
          return;
        }
        replaceWithRoute(fallback);
      }}
      style={{
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        minHeight: 38,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#E1E4E9",
        backgroundColor: "#ffffff",
        paddingHorizontal: 11,
        paddingVertical: 7,
      }}
    >
      <BackIcon size={18} color="#0B1F56" />
      <Text style={{ color: "#0B1F56", fontSize: 13, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
