import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";

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
import { DUES_ADMIN_COLORS as COLORS, DuesAdminButton } from "./DuesAdminPrimitives";


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
  const [draft, setDraft] = useState(() => createDuesPaymentEditorDraft(item, mode));
  const { scope, selectedBoardId } = draft;
  const payload = createDuesPaymentWritePayload(draft);
  const canSave = !saving && payload !== null;
  const submit = () => {
    if (!canSave || !payload) return;
    onSave(payload);
  };

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(11,31,86,0.35)", padding: 18 }}>
        <View style={{ width: "100%", maxWidth: 560, maxHeight: "88%", borderRadius: 10, backgroundColor: COLORS.surface, overflow: "hidden" }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={{ gap: 5 }}>
              <Text style={{ color: COLORS.primary900, fontSize: 20, fontWeight: "900" }}>
                {mode === "REGISTER_ONCE" ? "개별 행사 1회 납부 등록" : "원우회비 납부 설정"}
              </Text>
              <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
                {mode === "REGISTER_ONCE"
                  ? "선택한 활동인증 게시판에서만 검은색 납부자로 표시됩니다."
                  : "신원 정보는 원우 명부에서 관리합니다."}
              </Text>
            </View>

            <View style={{ borderRadius: 8, backgroundColor: COLORS.surfaceAlt, padding: 14, gap: 6 }}>
              <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: "900" }}>{item.name}</Text>
              <Text style={{ color: COLORS.muted }}>{item.student_number}</Text>
              <Text style={{ color: COLORS.muted }}>{item.major}</Text>
            </View>

            {mode === "EDIT" ? (
              <View style={{ gap: 8 }}>
                {SCOPE_OPTIONS.map((option) => {
                  const selected = scope === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDraft((current) => selectDuesPaymentScope(current, option.value))}
                      style={{
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
                        padding: 13,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: selected ? COLORS.primary900 : COLORS.text, fontWeight: "900" }}>{option.label}</Text>
                      <Text style={{ color: COLORS.muted, fontSize: 13 }}>{option.description}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {scope === "ONCE" ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: COLORS.text, fontWeight: "900" }}>활동인증 게시판 선택</Text>
                {activityBoards.length === 0 ? (
                  <Text style={{ color: COLORS.error }}>선택 가능한 활동인증 게시판이 없습니다.</Text>
                ) : null}
                {activityBoards.map((board) => {
                  const selected = selectedBoardId === board.id;
                  return (
                    <Pressable
                      key={board.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      onPress={() => setDraft((current) => selectDuesPaymentBoard(current, board.id))}
                      style={{
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: selected ? COLORS.primary : COLORS.border,
                        backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
                        padding: 12,
                      }}
                    >
                      <Text style={{ color: selected ? COLORS.primary900 : COLORS.text, fontWeight: "800" }}>{board.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <DuesAdminButton label="취소" tone="outline" disabled={saving} onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <DuesAdminButton
                  label={saving ? "저장 중..." : mode === "REGISTER_ONCE" ? "1회 납부 등록" : "저장"}
                  disabled={!canSave}
                  onPress={submit}
                />
              </View>
            </View>
          </ScrollView>
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
