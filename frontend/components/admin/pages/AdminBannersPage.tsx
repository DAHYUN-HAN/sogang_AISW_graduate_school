import { Ionicons } from "@expo/vector-icons";
import { useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { AppText as Text } from "../../AppTypography";
import MediaImage from "../../MediaImage";
import { formatBoardDateTime } from "../../../utils/dateFormat";
import AdminBannerPostPicker from "../AdminBannerPostPicker";
import AdminBannerSchedule from "../AdminBannerSchedule";
import { ActionButton, BANNER_IMAGE_SLOTS, BannerImageSlot, BannerPreview, COLORS, Field, StatusText } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <View style={styles.section}>
    <View style={{ gap: 6 }}><Text style={styles.sectionTitle}>{title}</Text>{hint ? <Text style={styles.muted}>{hint}</Text> : null}</View>
    {children}
  </View>;
}

export default function AdminBannersPage() {
  const { width } = useWindowDimensions();
  const wide = Platform.OS === "web" && width >= 1280;
  const [previewSlot, setPreviewSlot] = useState<BannerImageSlot>("mobile");
  const {
    bannerForm, bannerSaveMessage, bannerSaving, bannerUploadSlot, bannersQuery, boards,
    editingBannerId, handleEditBanner, handleHideBanner, handleSaveBanner, handleUploadBannerImage,
    nextBannerPosition, previewBannerPosition, previewBannerTotal, resetBannerForm,
    selectedBannerPosition, setBannerForm, sortedBanners,
  } = useAdminWorkspace();
  const active = sortedBanners.filter((banner) => banner.is_active).length;

  return <View style={{ gap: 28 }}>
    <View style={styles.summary}>
      {[["전체 배너", sortedBanners.length], ["표시 설정", active], ["숨김", sortedBanners.length - active]].map(([label, count]) =>
        <View key={label} style={{ minWidth: 120, gap: 12 }}><Text style={styles.muted}>{label}</Text><Text style={styles.metric}>{count}개</Text></View>)}
    </View>
    <View style={{ flexDirection: wide ? "row" : "column", alignItems: "flex-start", gap: 32 }}>
      <View style={{ width: wide ? 300 : "100%", gap: 16 }}>
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>배너 목록</Text><ActionButton label="신규 배너" icon="add-outline" tone="outline" onPress={resetBannerForm} /></View>
        {bannersQuery.isLoading ? <ActivityIndicator /> : null}
        {bannersQuery.isError ? <View style={{ gap: 10 }}><Text style={styles.muted}>배너 목록을 불러오지 못했습니다.</Text><ActionButton label="배너 다시 시도" tone="outline" onPress={() => void bannersQuery.refetch()} /></View> : null}
        {!bannersQuery.isLoading && !bannersQuery.isError && sortedBanners.length === 0 ? <Text style={[styles.muted, { paddingVertical: 24 }]}>등록된 배너가 없습니다.</Text> : null}
        <ScrollView style={{ maxHeight: wide ? undefined : 310 }} contentContainerStyle={{ flexGrow: 1 }}>
          {sortedBanners.map((item, index) => {
            const selected = editingBannerId === item.id;
            const image = item.image_urls?.mobile ?? item.image_url;
            return <View key={item.id} style={[styles.listItem, selected && { borderLeftWidth: 3, borderLeftColor: COLORS.primary, paddingLeft: 12 }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`${index + 1}번째 배너 선택`} aria-pressed={selected}
                onPress={() => handleEditBanner(item)} style={{ gap: 12 }}>
                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>{index + 1}번째 배너</Text><StatusText active={item.is_active} activeLabel="표시 설정" /></View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={styles.thumbnail}>{image ? <MediaImage media={{ url: image }} resizeMode="cover" style={{ width: "100%", height: "100%" }} /> : <Ionicons name="image-outline" color={COLORS.muted} size={22} />}</View>
                  <View style={{ flex: 1, minWidth: 0, gap: 5 }}><Text style={styles.label} numberOfLines={2}>{item.title || "이미지 배너"}</Text><Text style={styles.muted}>정렬 순서 {item.sort_order}</Text></View>
                </View>
                <Text style={styles.muted}>{item.starts_at ? formatBoardDateTime(item.starts_at) : "시작 제한 없음"}{"\n"}{item.ends_at ? `~ ${formatBoardDateTime(item.ends_at)}` : "종료 제한 없음"}</Text>
              </Pressable>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                <ActionButton label={selected ? "수정 중" : "선택/수정"} tone="outline" onPress={() => handleEditBanner(item)} />
                <ActionButton label="숨김" icon="eye-off-outline" tone="outline" disabled={!item.is_active} onPress={() => handleHideBanner(item)} />
              </View>
            </View>;
          })}
        </ScrollView>
        <Text style={styles.muted}>순서가 낮은 배너부터 표시합니다.</Text>
      </View>

      <View style={{ flex: 1, minWidth: 0, width: wide ? undefined : "100%", gap: 28 }}>
        <View style={styles.sectionHeader}>
          <Text style={styles.editorTitle}>{editingBannerId ? `${selectedBannerPosition ?? "-"}번째 배너 수정` : `${nextBannerPosition}번째 배너 등록`}</Text>
          {editingBannerId ? <ActionButton label="취소" tone="outline" onPress={resetBannerForm} /> : null}
        </View>
        {bannerSaveMessage ? <View accessibilityRole={bannerSaveMessage.tone === "error" ? "alert" : undefined} style={{ borderLeftWidth: 3, borderColor: bannerSaveMessage.tone === "error" ? COLORS.error : bannerSaveMessage.tone === "success" ? COLORS.success : COLORS.primary, paddingVertical: 10, paddingLeft: 14 }}>
          <Text style={{ fontSize: 13, color: bannerSaveMessage.tone === "error" ? COLORS.error : COLORS.text }}>{bannerSaveMessage.text}</Text>
        </View> : null}

        <Section title="배너 이미지" hint="문구는 이미지에 포함해주세요. 모바일·태블릿·데스크톱 중 하나 이상 등록하면 됩니다.">
          <View style={{ flexDirection: wide ? "row" : "column", gap: 20 }}>
          {BANNER_IMAGE_SLOTS.map((slot) => {
            const field = `${slot.key}_image_url` as const;
            return <View key={slot.key} style={[styles.imageRow, wide && { flex: 1, minWidth: 0 }]}>
              <View style={[styles.sectionHeader, wide && { flexDirection: "column", alignItems: "stretch" }]}>
                <View style={{ flex: 1, gap: 5 }}><Text style={styles.label}>{slot.label}</Text><Text style={styles.muted}>{slot.hint}</Text></View>
                <ActionButton label={bannerUploadSlot === slot.key ? "업로드 중" : `${slot.label} 이미지 업로드`} icon="cloud-upload-outline" tone="outline" disabled={bannerUploadSlot !== null} onPress={() => handleUploadBannerImage(slot.key)} />
              </View>
              <Field value={bannerForm[field]} onChangeText={(value) => setBannerForm((current) => ({ ...current, [field]: value }))} placeholder={`${slot.label} 이미지 URL`} />
            </View>;
          })}
          </View>
          <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
            {BANNER_IMAGE_SLOTS.map((slot) => <Pressable key={slot.key} accessibilityRole="button" accessibilityLabel={`${slot.label} 미리보기`} aria-pressed={previewSlot === slot.key} onPress={() => setPreviewSlot(slot.key)} style={[styles.previewTab, previewSlot === slot.key && { borderBottomColor: COLORS.primary }]}><Text style={{ color: previewSlot === slot.key ? COLORS.primary : COLORS.muted, fontSize: 12 }}>{slot.label}</Text></Pressable>)}
          </View>
          <View style={{ maxWidth: 340, width: "100%" }}><BannerPreview form={bannerForm} slot={previewSlot} index={previewBannerPosition - 1} total={previewBannerTotal} /></View>
        </Section>

        <Section title="노출 일정" hint="한국 시간 기준입니다. 비워둔 항목은 시간 제한 없이 적용됩니다.">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24 }}>
            <AdminBannerSchedule label="노출 시작" value={bannerForm.starts_at} fallbackTime="00:00" onChange={(value) => setBannerForm((current) => ({ ...current, starts_at: value }))} />
            <AdminBannerSchedule label="노출 종료" value={bannerForm.ends_at} fallbackTime="23:59" onChange={(value) => setBannerForm((current) => ({ ...current, ends_at: value }))} />
          </View>
        </Section>

        <Section title="배너 선택 시 이동" hint="게시글 목록에서 배너와 연결할 글을 선택해주세요.">
          <AdminBannerPostPicker value={bannerForm.cta_href} onChange={(value) => setBannerForm((current) => ({ ...current, cta_href: value }))} boards={boards} />
        </Section>

        <Section title="표시 설정">
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
            <View style={{ width: 160, gap: 8 }}><Text style={styles.label}>정렬 순서</Text><Field value={bannerForm.sort_order} onChangeText={(value) => setBannerForm((current) => ({ ...current, sort_order: value }))} placeholder="순서" /></View>
            <View style={{ gap: 8 }}><Text style={styles.label}>홈 표시 여부</Text><ActionButton label={bannerForm.is_active ? "홈에 표시" : "홈에서 숨김"} icon={bannerForm.is_active ? "eye-outline" : "eye-off-outline"} tone="outline" onPress={() => setBannerForm((current) => ({ ...current, is_active: !current.is_active }))} /></View>
          </View>
        </Section>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ActionButton label={bannerSaving ? "저장 중" : editingBannerId ? "배너 저장" : "배너 등록"} icon="checkmark-outline" disabled={bannerSaving || bannerUploadSlot !== null} onPress={handleSaveBanner} />
          {editingBannerId ? <ActionButton label="편집 취소" tone="outline" onPress={resetBannerForm} /> : null}
        </View>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 40, paddingBottom: 28, borderBottomWidth: 1, borderColor: COLORS.border },
  metric: { color: "#15171C", fontSize: 26, fontWeight: "600" },
  section: { gap: 20, paddingBottom: 28, borderBottomWidth: 1, borderColor: COLORS.border },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 15, color: "#15171C", fontWeight: "600" },
  editorTitle: { fontSize: 18, color: "#15171C", fontWeight: "600" },
  label: { color: COLORS.text, fontSize: 13, fontWeight: "500" },
  muted: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  listItem: { paddingVertical: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  thumbnail: { width: 80, height: 50, borderRadius: 6, overflow: "hidden", backgroundColor: "#F7F8FA", alignItems: "center", justifyContent: "center" },
  imageRow: { gap: 12, paddingBottom: 18, borderBottomWidth: 1, borderColor: COLORS.border },
  previewTab: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
});
