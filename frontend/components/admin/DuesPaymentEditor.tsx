import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../AppTypography";

import type {
  AdminDuesPaymentItem,
  Board,
  DuesPaymentScope,
  DuesPaymentWritePayload,
} from "../../types";
import {
  createDuesPaymentEditorDraft,
  createDuesPaymentWritePayload,
  selectDuesPaymentBoard,
  selectDuesPaymentScope,
  type DuesPaymentEditorMode,
} from "../../utils/duesPayers";
import { DUES_ADMIN_COLORS, DUES_ADMIN_WEB_COLORS, DuesAdminButton } from "./DuesAdminPrimitives";


const SCOPE_OPTIONS: { value: DuesPaymentScope; label: string; description: string }[] = [
  { value: "ALL", label: "전체 납부", description: "모든 활동인증에서 납부자로 표시" },
  { value: "ONCE", label: "특정 행사 1회 납부", description: "선택한 활동인증에서만 납부자로 표시" },
  { value: "UNPAID", label: "미납", description: "검색과 선택은 가능하지만 회색으로 표시" },
];

type Props = {
  visible: boolean;
  item: AdminDuesPaymentItem | null;
  mode?: DuesPaymentEditorMode;
  activityBoards: Board[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: DuesPaymentWritePayload) => void;
};

type ContentProps = Omit<Props, "visible" | "item"> & {
  item: AdminDuesPaymentItem;
};

export function DuesPaymentEditorContent({
  item,
  mode = "EDIT",
  activityBoards,
  saving,
  onClose,
  onSave,
}: ContentProps) {
  const web = Platform.OS === "web";
  const COLORS = web ? DUES_ADMIN_WEB_COLORS : DUES_ADMIN_COLORS;
  const [draft, setDraft] = useState(() => createDuesPaymentEditorDraft(item, mode));
  const { scope, selectedBoardId } = draft;
  const payload = createDuesPaymentWritePayload(draft);
  const canSave = !saving && payload !== null;
  const submit = () => {
    if (!canSave || !payload) return;
    onSave(payload);
  };

  const actions = <View style={{ flexDirection: "row", justifyContent: web ? "flex-end" : undefined, gap: 8 }}>
    <View style={{ flex: web ? undefined : 1 }}><DuesAdminButton label="취소" tone="outline" disabled={saving} onPress={onClose} /></View>
    <View style={{ flex: web ? undefined : 1 }}><DuesAdminButton label={saving ? "저장 중..." : mode === "REGISTER_ONCE" ? "1회 납부 등록" : "저장"} disabled={!canSave} onPress={submit} /></View>
  </View>;

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: web ? "rgba(17,24,39,0.25)" : "rgba(11,31,86,0.35)", padding: web ? 24 : 18 }}>
        <View style={{ width: "100%", maxWidth: 560, maxHeight: "88%", borderRadius: web ? 8 : 10, backgroundColor: COLORS.surface, overflow: "hidden", ...(web ? { borderWidth: 1, borderColor: COLORS.border } : {}) }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: web ? 24 : 20, gap: web ? 24 : 16 }}>
            <View style={{ gap: 5 }}>
              <Text style={{ color: COLORS.primary900, fontSize: web ? 18 : 20, fontWeight: web ? "600" : "900" }}>
                {mode === "REGISTER_ONCE" ? "개별 행사 1회 납부 등록" : "원우회비 납부 설정"}
              </Text>
              <Text style={{ color: COLORS.muted, lineHeight: 20, ...(web ? { fontSize: 12 } : {}) }}>
                {mode === "REGISTER_ONCE"
                  ? "선택한 활동인증 게시판에서만 검은색 납부자로 표시됩니다."
                  : "신원 정보는 원우 명부에서 관리합니다."}
              </Text>
            </View>

            <View style={web ? { borderTopWidth: 1, borderBottomWidth: 1, borderColor: COLORS.border, paddingVertical: 20, gap: 6 } : { borderRadius: 8, backgroundColor: COLORS.surfaceAlt, padding: 14, gap: 6 }}>
              <Text style={{ color: COLORS.text, fontSize: web ? 16 : 17, fontWeight: web ? "600" : "900" }}>{item.name}</Text>
              <Text style={{ color: COLORS.muted, ...(web ? { fontSize: 13 } : {}) }}>{item.student_number}</Text>
              <Text style={{ color: COLORS.muted, ...(web ? { fontSize: 13 } : {}) }}>{item.major}</Text>
            </View>

            {mode === "EDIT" ? (
              <View style={{ gap: 8 }}>
                {web && <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: "600" }}>납부 범위</Text>}
                {SCOPE_OPTIONS.map((option) => {
                  const selected = scope === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityState={{ checked: selected }}
                      disabled={web && saving}
                      onPress={() => setDraft((current) => selectDuesPaymentScope(current, option.value))}
                      style={{
                        borderRadius: web ? 0 : 8,
                        borderWidth: web ? 0 : 1,
                        borderBottomWidth: 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected && !web ? COLORS.primary50 : COLORS.surface,
                        padding: web ? 12 : 13,
                        gap: 4,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                        {web && <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: selected ? COLORS.primary : COLORS.borderStrong, alignItems: "center", justifyContent: "center" }}>{selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary }} />}</View>}
                        <Text style={{ color: selected ? web ? COLORS.primary : COLORS.primary900 : COLORS.text, fontWeight: web ? selected ? "600" : "400" : "900", ...(web ? { fontSize: 13 } : {}) }}>{option.label}</Text>
                      </View>
                      <Text style={{ color: COLORS.muted, fontSize: web ? 12 : 13, lineHeight: web ? 20 : undefined, ...(web ? { paddingLeft: 25 } : {}) }}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {scope === "ONCE" ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: COLORS.text, fontWeight: web ? "600" : "900", ...(web ? { fontSize: 15 } : {}) }}>활동인증 게시판 선택</Text>
                {activityBoards.length === 0 ? (
                  <Text style={{ color: COLORS.error }}>선택 가능한 활동인증 게시판이 없습니다.</Text>
                ) : null}
                {activityBoards.map((board) => {
                  const selected = selectedBoardId === board.id;
                  return (
                    <Pressable
                      key={board.id}
                      accessibilityRole="radio"
                      aria-checked={selected}
                      accessibilityState={{ checked: selected }}
                      disabled={web && saving}
                      onPress={() => setDraft((current) => selectDuesPaymentBoard(current, board.id))}
                      style={{
                        borderRadius: web ? 6 : 8,
                        borderWidth: 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected && !web ? COLORS.primary50 : COLORS.surface,
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: selected ? web ? COLORS.primary : COLORS.primary900 : COLORS.text, fontWeight: web ? selected ? "600" : "400" : "800", ...(web ? { fontSize: 13 } : {}) }}>{board.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!web && actions}
          </ScrollView>
          {web && <View style={{ padding: 20, borderTopWidth: 1, borderColor: COLORS.border }}>{actions}</View>}
        </View>
    </View>
  );
}

export default function DuesPaymentEditor({
  visible,
  item,
  mode = "EDIT",
  activityBoards,
  saving,
  onClose,
  onSave,
}: Props) {
  if (!item) return null;

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <DuesPaymentEditorContent
        key={`${mode}:${item.id}`}
        item={item}
        mode={mode}
        activityBoards={activityBoards}
        saving={saving}
        onClose={onClose}
        onSave={onSave}
      />
    </Modal>
  );
}
