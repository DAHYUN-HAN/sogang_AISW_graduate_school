import { createContext, useContext, type ReactNode } from "react";
import { Platform, View, type TextStyle } from "react-native";
import { AppText as Text } from "../AppTypography";

const BoardWebThemeContext = createContext(false);

/** Scope the main-console presentation to the web board workspace. */
export function AdminBoardWebTheme({ children }: { children: ReactNode }) {
  return <BoardWebThemeContext.Provider value={Platform.OS === "web"}>{children}</BoardWebThemeContext.Provider>;
}

export function useAdminBoardWebTheme() {
  return useContext(BoardWebThemeContext);
}

export const BOARD_WEB_COLORS = {
  text: "#15171C", muted: "#6B7280", border: "#E1E4E9",
  surface: "#FFFFFF", subtle: "#F7F8FA", primary: "#2761FF",
} as const;

export const BOARD_WEB_STYLES = {
  tabs: {
    flexDirection: "row", flexWrap: "wrap", gap: 4,
    borderBottomWidth: 1, borderColor: BOARD_WEB_COLORS.border,
  },
  row: {
    borderRadius: 0, borderWidth: 0, borderBottomWidth: 1,
    borderColor: BOARD_WEB_COLORS.border, backgroundColor: BOARD_WEB_COLORS.surface,
    paddingHorizontal: 0, paddingVertical: 20,
  },
} as const;

export function BoardSectionTitle({ children, style }: { children: ReactNode; style?: TextStyle }) {
  const themed = useAdminBoardWebTheme();
  return <Text style={[style, themed && { color: BOARD_WEB_COLORS.text, fontSize: 15, fontWeight: "600", lineHeight: 22 }]}>{children}</Text>;
}

export function BoardFilterRow({ children }: { children: ReactNode }) {
  const themed = useAdminBoardWebTheme();
  return <View style={themed ? BOARD_WEB_STYLES.tabs : { flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{children}</View>;
}
