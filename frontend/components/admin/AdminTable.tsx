import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { AppText as Text } from "../AppTypography";

export type AdminTableColumn = { label: string; flex?: number; width?: number };
export default function AdminTable({ columns, rows, minimumWidth = 700, emptyContent }: { columns: AdminTableColumn[]; rows: { key: string | number; cells: ReactNode[] }[]; minimumWidth?: number; emptyContent?: ReactNode }) {
  return <View style={{ borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 8, overflow: "hidden" }}><ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}><View style={{ minWidth: minimumWidth, flexGrow: 1 }}>
    <View style={{ flexDirection: "row", backgroundColor: "#F8FAFC", paddingHorizontal: 16, paddingVertical: 13, gap: 18 }}>{columns.map((column, index) => <Text key={index} style={{ flex: column.width ? undefined : column.flex ?? 1, width: column.width, fontWeight: "600", color: "#6B7280", fontSize: 12 }}>{column.label}</Text>)}</View>
    {rows.map((row) => <View key={row.key} style={{ flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 16, gap: 18, borderTopWidth: 1, borderColor: "#E1E4E9" }}>{columns.map((column, index) => <View key={index} style={{ flex: column.width ? undefined : column.flex ?? 1, width: column.width, minWidth: 0 }}>{row.cells[index]}</View>)}</View>)}
    {rows.length === 0 && emptyContent && <View style={{ borderTopWidth: 1, borderColor: "#E1E4E9", padding: 48, alignItems: "center", gap: 12 }}>{emptyContent}</View>}
  </View></ScrollView></View>;
}
