import { Children, type ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";

export default function AdminColumns({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  const { width } = useWindowDimensions();
  const columns = Platform.OS !== "web" || width < 1100 ? 1 : compact && width >= 1600 ? 3 : 2;
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>{Children.toArray(children).map((child, index) => <View key={index} style={{ width: columns === 1 ? "100%" : columns === 3 ? "32%" : "48.8%", minWidth: 0 }}>{child}</View>)}</View>;
}
