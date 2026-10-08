import { useEffect, useSyncExternalStore } from "react";
import { Modal, Platform, Pressable, View } from "react-native";
import { adminDialogQueue } from "../../utils/adminAlert";
import { AppText as Text } from "../AppTypography";

export default function AdminAlertHost() {
  useEffect(() => () => adminDialogQueue.clear(), []);
  const dialog = useSyncExternalStore(adminDialogQueue.subscribe, adminDialogQueue.current, () => null);
  // Modal owns Escape on keyup. A separate keydown handler could dismiss the
  // dialog early and send that keyup to the editor underneath, reopening it.
  if (!dialog || Platform.OS !== "web") return null;
  const buttons = dialog.buttons?.length ? dialog.buttons : [{ text: "확인" }];
  return <Modal visible transparent animationType="fade" onRequestClose={() => adminDialogQueue.cancel(dialog)}>
    <View style={{ flex: 1, backgroundColor: "rgba(17,24,39,.3)", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <View accessibilityRole="alert" accessibilityLabel={dialog.title} style={{ width: "100%", maxWidth: 460, backgroundColor: "#FFFFFF", borderRadius: 12, padding: 24, gap: 18 }}>
        <Text accessibilityRole="header" style={{ fontSize: 20, fontWeight: "600" }}>{dialog.title}</Text>
        {!!dialog.message && <Text style={{ color: "#6B7280", lineHeight: 23 }}>{dialog.message}</Text>}
        <View style={{ flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 8 }}>{buttons.map((button, index) => <Pressable key={index} accessibilityRole="button" accessibilityLabel={button.text ?? "확인"} onPress={() => adminDialogQueue.choose(index, dialog)} style={{ paddingHorizontal: 18, paddingVertical: 12, borderRadius: 7, borderWidth: 1, borderColor: "#E1E4E9", backgroundColor: button.style === "cancel" ? "#FFFFFF" : button.style === "destructive" ? "#D94343" : "#2761FF" }}><Text style={{ fontWeight: "600", color: button.style === "cancel" ? "#111827" : "#FFFFFF" }}>{button.text ?? "확인"}</Text></Pressable>)}</View>
      </View>
    </View>
  </Modal>;
}
