import { Pressable, View } from "react-native";
import { AppText as Text, AppTextInput as TextInput } from "../AppTypography";

import type { AdminBoardSettingsDraft } from "../../utils/adminBoardSettings";
import type { AdminBoardLockedPolicy, AdminBoardSettingKey } from "../../utils/adminContentManagement";
import type { Board } from "../../types";
import type { ActivityImageRule } from "../../utils/activityImageLayout";

export type AdminBoardSettingsPanelProps = {
  board: Board;
  draft: AdminBoardSettingsDraft;
  lockedPolicies: readonly AdminBoardLockedPolicy[];
  saving: boolean;
  onChange: (draft: AdminBoardSettingsDraft) => void;
  onSave: () => void;
};

const settingKey: Record<AdminBoardSettingKey, keyof AdminBoardSettingsDraft> = {
  allow_anonymous: "allowAnonymous",
  write_permission: "writePermission",
  read_permission: "readPermission",
};

const READ_PERMISSION_OPTIONS = ["guest", "user", "admin"] as const;
const WRITE_PERMISSION_OPTIONS = ["user", "admin"] as const;
const ORIENTATIONS: { key: "landscape" | "portrait"; label: string }[] = [
  { key: "landscape", label: "가로형" },
  { key: "portrait", label: "세로형" },
];

export function adminBoardPermissionOptions(kind: "read" | "write") {
  return kind === "read" ? [...READ_PERMISSION_OPTIONS] : [...WRITE_PERMISSION_OPTIONS];
}

function Input({
  label,
  value,
  onChangeText,
  multiline,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  editable?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: "#374151", fontSize: 12, fontWeight: "900" }}>{label}</Text>
      <TextInput
        value={value}
        editable={editable}
        multiline={multiline}
        onChangeText={onChangeText}
        style={{
          minHeight: multiline ? 96 : 44,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "#E1E4E9",
          backgroundColor: editable ? "#ffffff" : "#F8FAFC",
          color: "#111827",
          paddingHorizontal: 12,
          paddingVertical: 10,
          textAlignVertical: multiline ? "top" : "center",
        }}
      />
    </View>
  );
}

function Choice({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled), selected }}
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 6,
        borderWidth: 1,
        borderColor: selected ? "#2761FF" : "#E1E4E9",
        backgroundColor: selected ? "#EDF2FE" : "#ffffff",
        opacity: disabled ? 0.45 : 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
    >
      <Text style={{ color: selected ? "#2761FF" : "#374151", fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

function ActivityRuleEditor({ label, rule, disabled, onChange }: { label: string; rule: ActivityImageRule; disabled?: boolean; onChange: (rule: ActivityImageRule) => void }) {
  const updateNumber = (key: "max_width" | "height" | "max_height", value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    const next = digits ? Number(digits) : null;
    onChange(key === "height" && next !== null ? { ...rule, height: next, max_height: null } : { ...rule, [key]: next });
  };
  return (
    <View style={{ gap: 8, borderRadius: 8, borderWidth: 1, borderColor: "#E1E4E9", padding: 10 }}>
      <Text style={{ color: "#374151", fontSize: 12, fontWeight: "900" }}>{label}</Text>
      <Text style={{ color: "#6B7280", fontSize: 11 }}>최대 가로 px (120–1600, 빈 값은 화면 너비)</Text>
      <TextInput editable={!disabled} value={rule.max_width === null ? "" : String(rule.max_width)} onChangeText={(value) => updateNumber("max_width", value)} keyboardType="number-pad" style={{ minHeight: 40, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 10 }} />
      <Text style={{ color: "#6B7280", fontSize: 11 }}>세로 px (빈 값은 원본 비율, 고정 시 120–1600)</Text>
      <TextInput editable={!disabled} value={rule.height === null ? "" : String(rule.height)} onChangeText={(value) => updateNumber("height", value)} keyboardType="number-pad" style={{ minHeight: 40, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 10 }} />
      <Text style={{ color: "#6B7280", fontSize: 11 }}>최대 세로 px (120–2000, 고정 세로 사용 시 자동 제거)</Text>
      <TextInput editable={!disabled && rule.height === null} value={rule.height !== null || rule.max_height === null ? "" : String(rule.max_height)} onChangeText={(value) => updateNumber("max_height", value)} keyboardType="number-pad" style={{ minHeight: 40, borderWidth: 1, borderColor: "#E1E4E9", borderRadius: 6, paddingHorizontal: 10, backgroundColor: rule.height !== null ? "#F8FAFC" : "#FFFFFF" }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Choice label="contain" selected={rule.fit === "contain"} disabled={disabled} onPress={() => onChange({ ...rule, fit: "contain" })} />
        <Choice label="cover" selected={rule.fit === "cover"} disabled={disabled} onPress={() => onChange({ ...rule, fit: "cover" })} />
      </View>
    </View>
  );
}

export default function AdminBoardSettingsPanel({ board, draft, lockedPolicies, saving, onChange, onSave }: AdminBoardSettingsPanelProps) {
  const lockedDraftFields = new Set(
    lockedPolicies
      .map((policy) => policy.settingKey)
      .filter((key): key is AdminBoardSettingKey => key !== null)
      .map((key) => settingKey[key]),
  );

  const update = <Key extends keyof AdminBoardSettingsDraft>(key: Key, value: AdminBoardSettingsDraft[Key]) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ gap: 8, borderRadius: 8, backgroundColor: "#F8FAFC", padding: 12 }}>
        <Text style={{ color: "#0B1F56", fontWeight: "900" }}>구조 식별자 · 변경 불가</Text>
        <Text style={{ color: "#6B7280", fontSize: 12 }}>slug · {board.slug}</Text>
        <Text style={{ color: "#6B7280", fontSize: 12 }}>category · {board.category}</Text>
        <Text style={{ color: "#6B7280", fontSize: 12 }}>board_type · {board.board_type}</Text>
      </View>

      {lockedPolicies.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: "#0B1F56", fontWeight: "900" }}>고정 운영 정책</Text>
          {lockedPolicies.map((policy) => (
            <View key={policy.key} style={{ gap: 3, borderRadius: 8, borderWidth: 1, borderColor: "#D5E0FE", backgroundColor: "#EDF2FE", padding: 10 }}>
              <Text style={{ color: "#0B3AC4", fontWeight: "900" }}>{policy.label}</Text>
              <Text style={{ color: "#374151", fontSize: 12 }}>{policy.reason}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Input label="이름" value={draft.name} editable={!saving} onChangeText={(value) => update("name", value)} />
      <Input label="설명" value={draft.description} multiline editable={!saving} onChangeText={(value) => update("description", value)} />
      <Input label="정렬 순서" value={draft.sortOrder} editable={!saving} onChangeText={(value) => update("sortOrder", value.replace(/[^0-9-]/g, ""))} />

      <View style={{ gap: 7 }}>
        <Text style={{ color: "#374151", fontSize: 12, fontWeight: "900" }}>읽기 권한</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {adminBoardPermissionOptions("read").map((permission) => (
            <Choice key={permission} label={permission} selected={draft.readPermission === permission} disabled={saving || lockedDraftFields.has("readPermission")} onPress={() => update("readPermission", permission)} />
          ))}
        </View>
      </View>

      <View style={{ gap: 7 }}>
        <Text style={{ color: "#374151", fontSize: 12, fontWeight: "900" }}>쓰기 권한</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {adminBoardPermissionOptions("write").map((permission) => (
            <Choice key={permission} label={permission} selected={draft.writePermission === permission} disabled={saving || lockedDraftFields.has("writePermission")} onPress={() => update("writePermission", permission)} />
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Choice
          label={draft.allowAnonymous ? "익명 허용" : "실명 게시"}
          selected={draft.allowAnonymous}
          disabled={saving || lockedDraftFields.has("allowAnonymous")}
          onPress={() => update("allowAnonymous", !draft.allowAnonymous)}
        />
        <Choice label={draft.isActive ? "활성" : "숨김"} selected={draft.isActive} disabled={saving} onPress={() => update("isActive", !draft.isActive)} />
      </View>

      {board.board_type === "activity_certification" && draft.activityImageLayout ? (
        <View style={{ gap: 10 }}>
          <Text style={{ color: "#0B1F56", fontWeight: "900" }}>활동 인증 이미지 표시</Text>
          <ActivityRuleEditor label="기본 규칙" rule={draft.activityImageLayout.default} disabled={saving} onChange={(rule) => onChange({ ...draft, activityImageLayout: { ...draft.activityImageLayout!, default: rule } })} />
          {ORIENTATIONS.map(({ key, label }) => {
            const rule = draft.activityImageLayout?.[key];
            return (
              <View key={key} style={{ gap: 8 }}>
                <Choice label={`${label} 예외 사용`} selected={Boolean(rule)} disabled={saving} onPress={() => onChange({ ...draft, activityImageLayout: { ...draft.activityImageLayout!, [key]: rule ? null : { ...draft.activityImageLayout!.default } } })} />
                {rule ? <ActivityRuleEditor label={`${label} 규칙`} rule={rule} disabled={saving} onChange={(next) => onChange({ ...draft, activityImageLayout: { ...draft.activityImageLayout!, [key]: next } })} /> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <Text style={{ color: "#6B7280", fontSize: 12, lineHeight: 18 }}>
        게시판을 숨겨도 기존 게시글과 첨부파일은 삭제되지 않습니다.
      </Text>

      <Pressable
        disabled={saving}
        onPress={onSave}
        style={{ alignItems: "center", borderRadius: 6, backgroundColor: "#2761FF", opacity: saving ? 0.5 : 1, padding: 12 }}
      >
        <Text style={{ color: "#ffffff", fontWeight: "900" }}>{saving ? "저장 중" : "운영 설정 저장"}</Text>
      </Pressable>
    </View>
  );
}
