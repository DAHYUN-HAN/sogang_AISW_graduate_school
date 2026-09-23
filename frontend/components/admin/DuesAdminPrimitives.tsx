import { Ionicons } from "@expo/vector-icons";
import { isAxiosError } from "axios";
import * as DocumentPicker from "expo-document-picker";
import { Platform, Pressable, Text } from "react-native";


export const DUES_ADMIN_COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary900: "#0B1F56",
  error: "#D94343",
  border: "#E1E4E9",
  borderStrong: "#C7CDD4",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FAFC",
  text: "#111827",
  muted: "#6B7280",
};

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export type DuesWorkbookFile = File | { uri: string; name: string; type: string };

export function duesApiErrorMessage(error: unknown, fallback: string) {
  if (!isAxiosError(error)) return fallback;
  const data = error.response?.data as { message?: unknown } | undefined;
  return typeof data?.message === "string" ? data.message : fallback;
}

function pickWebWorkbook() {
  return new Promise<File | null>((resolve) => {
    const input = document.createElement("input");
    let settled = false;
    const cleanup = () => {
      input.removeEventListener("change", handleChange);
      input.removeEventListener("cancel", handleCancel);
      window.removeEventListener("focus", handleWindowFocus);
      input.remove();
    };
    const settle = (file: File | null) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(file);
    };
    const handleChange = () => settle(input.files?.[0] ?? null);
    const handleCancel = () => settle(null);
    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!settled && (!input.files || input.files.length === 0)) settle(null);
      }, 600);
    };
    input.type = "file";
    input.accept = `.xlsx,${XLSX_MIME}`;
    input.style.display = "none";
    input.addEventListener("change", handleChange);
    input.addEventListener("cancel", handleCancel);
    window.addEventListener("focus", handleWindowFocus);
    document.body.appendChild(input);
    input.click();
  });
}

export async function pickDuesWorkbook(): Promise<DuesWorkbookFile | null> {
  if (Platform.OS === "web") return pickWebWorkbook();
  const result = await DocumentPicker.getDocumentAsync({
    type: XLSX_MIME,
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.name || "원우명부.xlsx",
    type: asset.mimeType || XLSX_MIME,
  };
}

export function DuesAdminButton({
  label,
  onPress,
  tone = "primary",
  disabled = false,
  icon,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "outline";
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const colors = DUES_ADMIN_COLORS;
  const backgroundColor = disabled
    ? colors.borderStrong
    : tone === "outline"
      ? colors.surface
      : colors.primary;
  const foreground = tone === "outline" ? colors.primary : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 42,
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "row",
        gap: 7,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: disabled ? colors.borderStrong : colors.primary,
        backgroundColor,
        paddingHorizontal: 14,
      }}
    >
      {icon ? <Ionicons name={icon} size={17} color={foreground} /> : null}
      <Text style={{ color: foreground, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}
