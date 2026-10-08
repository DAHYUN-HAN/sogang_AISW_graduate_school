import { ActivityIndicator, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { ActionButton, COLORS, Field, MajorOptionEditor, Panel } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";

import AdminColumns from "../AdminColumns";
export default function AdminRegistrationPage() {
  const { adminMajors, adminMajorsQuery, adminPrivacyPolicy, adminPrivacyPolicyQuery, handleCreateMajor, handleSaveMajor, handleSavePrivacyPolicy, newMajorName, newMajorOrder, policyEffectiveAt, policyVersion, setNewMajorName, setNewMajorOrder, setPolicyEffectiveAt, setPolicyVersion } = useAdminWorkspace();
  return (<View style={{ gap: 20 }}><AdminColumns><Panel>
    <View style={{ gap: 10 }}>
      <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>개인정보 처리방침 버전</Text>
      <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
        신규 회원은 저장 시점의 활성 버전에 동의해야 하며, 동의 시각과 버전이 계정에 기록됩니다.
      </Text>
      {adminPrivacyPolicy ? (
        <Text style={{ color: COLORS.success, fontSize: 12, fontWeight: "600" }}>
          현재 적용: v{adminPrivacyPolicy.version} · {adminPrivacyPolicy.effective_at.slice(0, 16).replace("T", " ")}
        </Text>
      ) : null}
      <Field value={policyVersion} onChangeText={setPolicyVersion} placeholder="정책 버전 (예: 2026-07-12)" />
      <Field value={policyEffectiveAt} onChangeText={setPolicyEffectiveAt} placeholder="시행일시 (YYYY-MM-DDTHH:mm)" />
      <ActionButton icon="shield-checkmark-outline" label="정책 버전 적용" onPress={() => void handleSavePrivacyPolicy()} />
    </View>
  </Panel>
    <Panel>
      <View style={{ gap: 10 }}>
        <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>전공 추가</Text>
        <Text style={{ color: COLORS.muted, lineHeight: 20 }}>
          활성 전공만 회원가입 선택 목록에 노출됩니다. 기존 회원이 사용 중인 전공은 비활성화해도 기록이 유지됩니다.
        </Text>
        <Field value={newMajorName} onChangeText={setNewMajorName} placeholder="전공명" />
        <Field value={newMajorOrder} onChangeText={(value) => setNewMajorOrder(value.replace(/\D/g, ""))} placeholder="정렬 순서" />
        <ActionButton icon="add-outline" label="전공 추가" onPress={() => void handleCreateMajor()} />
      </View>
    </Panel></AdminColumns>{adminMajorsQuery.isLoading || adminPrivacyPolicyQuery.isLoading ? <ActivityIndicator /> : null}
    {adminMajorsQuery.isError || adminPrivacyPolicyQuery.isError ? (
      <Panel><Text style={{ color: COLORS.error, fontWeight: "600" }}>가입 설정을 불러오지 못했습니다.</Text></Panel>
    ) : null}<AdminColumns>{adminMajors.map((item) => (
      <MajorOptionEditor key={item.id} item={item} onSave={handleSaveMajor} />
    ))}</AdminColumns></View>);
}
