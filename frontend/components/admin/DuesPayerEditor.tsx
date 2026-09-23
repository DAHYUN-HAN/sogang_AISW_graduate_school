import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type {
  AdminDuesPayerItem,
  Board,
  DuesPaymentScope,
  DuesPayerWritePayload,
} from "../../types";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  border: "#E1E4E9",
  borderStrong: "#C7CDD4",
  surface: "#FFFFFF",
  text: "#111827",
  muted: "#6B7280",
};

const SCOPE_OPTIONS: { value: DuesPaymentScope; label: string; description: string }[] = [
  { value: "ALL", label: "전체 납부", description: "모든 활동인증에서 납부자로 표시" },
  { value: "ONCE", label: "특정 행사 1회 납부", description: "선택한 활동인증에서만 납부자로 표시" },
  { value: "UNPAID", label: "미납", description: "검색은 가능하지만 미납자로 표시" },
];

type Props = {
  visible: boolean;
  item: AdminDuesPayerItem | null;
  activityBoards: Board[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: DuesPayerWritePayload) => void;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "none",
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  autoCapitalize?: "none" | "characters";
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.muted}
        autoCapitalize={autoCapitalize}
        style={{
          minHeight: 44,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: COLORS.borderStrong,
          color: COLORS.text,
          paddingHorizontal: 12,
        }}
      />
    </View>
  );
}

export default function DuesPayerEditor({
  visible,
  item,
  activityBoards,
  saving,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [major, setMajor] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [scope, setScope] = useState<DuesPaymentScope>("UNPAID");
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null);

  useEffect(() => {
    if (!visible) return;
    setName(item?.name ?? "");
    setMajor(item?.major ?? "");
    setStudentNumber(item?.student_number ?? "");
    setScope(item?.payment_scope ?? "UNPAID");
    setSelectedBoardId(item?.once_board_id ?? null);
  }, [item, visible]);

  const normalizedStudentNumber = studentNumber.trim().toUpperCase();
  const canSave =
    !saving
    && name.trim().length > 0
    && major.trim().length > 0
    && /^A\d{5}$/.test(normalizedStudentNumber)
    && (scope !== "ONCE" || selectedBoardId !== null);

  const submit = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      major: major.trim(),
      student_number: normalizedStudentNumber,
      payment_scope: scope,
      once_board_id: scope === "ONCE" ? selectedBoardId : null,
    });
  };

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          padding: 20,
        }}
      >
        <View style={{ width: "100%", maxWidth: 520, maxHeight: "90%", borderRadius: 16, backgroundColor: COLORS.surface }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            <View style={{ gap: 4 }}>
              <Text style={{ color: COLORS.text, fontSize: 20, fontWeight: "900" }}>
                {item ? "원우 납부 상태 수정" : "원우 개별 등록"}
              </Text>
              <Text style={{ color: COLORS.muted, fontSize: 13 }}>
                학번과 이름은 엑셀 명부 매칭 기준이므로 정확히 입력해 주세요.
              </Text>
            </View>

            <Field label="이름" value={name} onChangeText={setName} placeholder="홍길동" />
            <Field label="전공" value={major} onChangeText={setMajor} placeholder="인공지능" />
            <Field
              label="학번"
              value={studentNumber}
              onChangeText={setStudentNumber}
              placeholder="A74001"
              autoCapitalize="characters"
            />

            <View style={{ gap: 8 }}>
              <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>납부 범위</Text>
              {SCOPE_OPTIONS.map((option) => {
                const selected = scope === option.value;
                return (
                  <Pressable
                    key={option.value}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    disabled={saving}
                    onPress={() => {
                      setScope(option.value);
                      if (option.value !== "ONCE") setSelectedBoardId(null);
                    }}
                    style={{
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
                      padding: 12,
                      gap: 3,
                    }}
                  >
                    <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontWeight: "900" }}>
                      {option.label}
                    </Text>
                    <Text style={{ color: COLORS.muted, fontSize: 12 }}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>

            {scope === "ONCE" ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: COLORS.text, fontSize: 13, fontWeight: "800" }}>적용할 활동인증 게시판</Text>
                {activityBoards.length === 0 ? (
                  <Text style={{ color: COLORS.muted, fontSize: 13 }}>선택할 수 있는 활성 활동인증 게시판이 없습니다.</Text>
                ) : (
                  activityBoards.map((board) => {
                    const selected = selectedBoardId === board.id;
                    return (
                      <Pressable
                        key={board.id}
                        disabled={saving}
                        onPress={() => setSelectedBoardId(board.id)}
                        style={{
                          minHeight: 42,
                          justifyContent: "center",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: selected ? COLORS.primary : COLORS.border,
                          backgroundColor: selected ? COLORS.primary50 : COLORS.surface,
                          paddingHorizontal: 12,
                        }}
                      >
                        <Text style={{ color: selected ? COLORS.primary : COLORS.text, fontWeight: "800" }}>
                          {board.name}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable
                disabled={saving}
                onPress={onClose}
                style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 8, backgroundColor: "#F3F4F6" }}
              >
                <Text style={{ color: COLORS.text, fontWeight: "800" }}>취소</Text>
              </Pressable>
              <Pressable
                disabled={!canSave}
                onPress={submit}
                style={{
                  flex: 1,
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 8,
                  backgroundColor: canSave ? COLORS.primary : COLORS.borderStrong,
                }}
              >
                <Text style={{ color: COLORS.surface, fontWeight: "900" }}>{saving ? "저장 중..." : "저장"}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
