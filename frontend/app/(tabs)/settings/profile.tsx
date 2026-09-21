import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingState from "../../../components/LoadingState";
import MediaImage from "../../../components/MediaImage";
import { useReturnToMyPageDrawer } from "../../../hooks/useReturnToMyPageDrawer";
import { registrationApi, userApi } from "../../../services/api";
import { pickAndUploadImage } from "../../../utils/mediaPicker";
import { apiErrorCode, phoneError } from "../../../utils/authValidation";
import { buildProfileUpdatePayload } from "../../../utils/profileUpdate";

import { BackIcon, DefaultAvatarIcon } from "../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  primary50: "#E6F1FB",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  danger: "#E24B4A",
};

type FieldValues = {
  nickname: string;
  cohort: string;
  major: string;
  phone: string;
};

export default function ProfileSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { returnToMyPageDrawer, onLayout } = useReturnToMyPageDrawer("/settings/profile");
  const queryClient = useQueryClient();
  const registrationOptionsQuery = useQuery({
    queryKey: ["registration-options"],
    queryFn: registrationApi.getOptions,
    staleTime: 60_000,
  });
  const profileQuery = useQuery({
    queryKey: ["me"],
    queryFn: userApi.getMe,
    refetchOnWindowFocus: false,
  });
  const majorOptions = registrationOptionsQuery.data?.data.majors ?? [];
  const [fields, setFields] = useState<FieldValues>({
    nickname: "",
    cohort: "",
    major: "",
    phone: "",
  });
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [profileImageMediaId, setProfileImageMediaId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [majorModalVisible, setMajorModalVisible] = useState(false);
  const [photoSheetVisible, setPhotoSheetVisible] = useState(false);

  useEffect(() => {
    const profile = profileQuery.data?.data;
    if (!profile) return;
    setFields({
      nickname: profile.nickname ?? "",
      cohort: profile.cohort ?? "",
      major: profile.major ?? "",
      phone: profile.phone ?? "",
    });
    setProfileImageUrl(profile.profile_image_url ?? null);
    setProfileImageMediaId(profile.profile_image_media_id ?? null);
  }, [profileQuery.data]);

  const selectProfileImage = async () => {
    try {
      setIsUploadingImage(true);
      const image = await pickAndUploadImage();
      if (image) {
        const profileImageReference = image.url?.trim();
        if (!profileImageReference) throw new Error("MEDIA_REFERENCE_MISSING");
        setProfileImageUrl(profileImageReference);
        setProfileImageMediaId(image.id);
      }
    } catch {
      Alert.alert("이미지 업로드 실패", "사진 접근 권한 또는 업로드 상태를 확인해주세요.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const save = async () => {
    const currentProfile = profileQuery.data?.data;
    if (!currentProfile) return;

    const updatePayload = buildProfileUpdatePayload(currentProfile, {
      major: fields.major,
      phone: fields.phone,
      profile_image_url: profileImageUrl,
    });
    if (
      "major" in updatePayload &&
      (!updatePayload.major || !majorOptions.some((option) => option.name === updatePayload.major))
    ) {
      setFieldError("관리자가 등록한 전공 중 하나를 선택해주세요.");
      return;
    }
    const changedPhone = "phone" in updatePayload ? updatePayload.phone ?? "" : "";
    const nextPhoneError = changedPhone ? phoneError(changedPhone.replace(/\D/g, "")) : null;
    if (nextPhoneError) {
      setFieldError(nextPhoneError);
      return;
    }
    try {
      setIsSubmitting(true);
      if (Object.keys(updatePayload).length > 0) {
        await userApi.updateMe(updatePayload);
        const refreshedProfile = await userApi.getMe();
        queryClient.setQueryData(["me"], refreshedProfile);
      }
      Alert.alert("저장 완료", "프로필이 저장되었습니다.");
      router.replace("/(tabs)/settings");
    } catch (error) {
      setFieldError(
        apiErrorCode(error) === "VALIDATION_ERROR"
          ? "현재 선택할 수 있는 전공을 다시 선택해주세요."
          : "입력한 정보를 확인해주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasProfileImage = Boolean(profileImageMediaId || profileImageUrl);
  const cohortLabel = fields.cohort
    ? fields.cohort.endsWith("기")
      ? fields.cohort
      : `${fields.cohort}기`
    : "-";
  const saveDisabled = isSubmitting || isUploadingImage;

  return (
    <View style={styles.screen} onLayout={onLayout}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={returnToMyPageDrawer}
          style={styles.iconButton}
        >
          <BackIcon size={24} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>프로필 수정</Text>
        <View style={styles.iconButton} />
      </View>

      {profileQuery.isLoading ? (
        <LoadingState />
      ) : profileQuery.isError ? (
        <View style={styles.center}>
          <Text style={styles.loadErrorText}>프로필을 불러오지 못했습니다.</Text>
          <Pressable accessibilityRole="button" onPress={() => void profileQuery.refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroller} contentContainerStyle={styles.content}>
        <View style={styles.avatarSection}>
          <Pressable disabled={isUploadingImage} onPress={() => setPhotoSheetVisible(true)} style={styles.avatarButton}>
            {hasProfileImage ? (
              <MediaImage media={{ id: profileImageMediaId, url: profileImageUrl }} style={styles.avatarImage} />
            ) : (
              <DefaultAvatarIcon size={80} />
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={12} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>이름</Text>
            <View style={styles.lockedInput}>
              <Text style={styles.lockedInputText}>{fields.nickname || "-"}</Text>
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.subtle} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>기수</Text>
            <View style={styles.lockedInput}>
              <Text style={styles.lockedInputText}>{cohortLabel}</Text>
              <Ionicons name="lock-closed-outline" size={15} color={COLORS.subtle} />
            </View>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>전공</Text>
            <Pressable
              accessibilityRole="button"
              disabled={registrationOptionsQuery.isLoading || majorOptions.length === 0}
              onPress={() => setMajorModalVisible(true)}
              style={styles.selectInput}
            >
              <Text style={[styles.selectInputText, !fields.major ? styles.selectPlaceholder : null]}>
                {fields.major || "전공 선택"}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.subtle} />
            </Pressable>
            {registrationOptionsQuery.isError ? (
              <View style={styles.inlineError}>
                <Text style={styles.errorText}>전공 목록을 불러오지 못했습니다.</Text>
                <Pressable accessibilityRole="button" onPress={() => void registrationOptionsQuery.refetch()} style={styles.inlineRetryButton}>
                  <Text style={styles.inlineRetryText}>다시 시도</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>연락처</Text>
            <TextInput
              keyboardType="phone-pad"
              maxLength={11}
              onChangeText={(next) => {
                setFields((current) => ({ ...current, phone: next.replace(/\D/g, "").slice(0, 11) }));
                setFieldError("");
              }}
              placeholder="연락처"
              placeholderTextColor={COLORS.subtle}
              style={styles.input}
              value={fields.phone}
            />
          </View>
        </View>

        {fieldError ? <Text style={styles.errorText}>{fieldError}</Text> : null}

        <Pressable disabled={saveDisabled} onPress={save} style={[styles.primaryButton, saveDisabled ? styles.disabledButton : null]}>
          <Text style={styles.primaryButtonText}>{isSubmitting ? "저장 중" : "완료"}</Text>
        </Pressable>
        </ScrollView>
      )}

      <Modal animationType="slide" transparent visible={majorModalVisible} onRequestClose={() => setMajorModalVisible(false)}>
        <Pressable onPress={() => setMajorModalVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>전공 선택</Text>
            {majorOptions.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setFields((current) => ({ ...current, major: option.name }));
                  setFieldError("");
                  setMajorModalVisible(false);
                }}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionText}>{option.name}</Text>
                {fields.major === option.name ? <Ionicons name="checkmark" size={19} color={COLORS.primary} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal animationType="slide" transparent visible={photoSheetVisible} onRequestClose={() => setPhotoSheetVisible(false)}>
        <Pressable onPress={() => setPhotoSheetVisible(false)} style={styles.modalBackdrop}>
          <Pressable onPress={() => undefined} style={styles.modalCard}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>프로필 사진 변경</Text>
            <Pressable
              onPress={() => {
                setPhotoSheetVisible(false);
                void selectProfileImage();
              }}
              style={styles.modalOption}
            >
              <Text style={styles.modalOptionText}>앨범에서 사진 선택</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setProfileImageUrl(null);
                setProfileImageMediaId(null);
                setPhotoSheetVisible(false);
              }}
              style={styles.modalOption}
            >
              <Text style={styles.modalOptionText}>기본 이미지 적용</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadErrorText: {
    color: COLORS.muted,
    fontSize: 14,
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
  },
  scroller: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 42,
  },
  avatarSection: {
    alignItems: "center",
    paddingTop: 16,
    paddingBottom: 24,
  },
  avatarButton: {
    width: 80,
    height: 80,
  },
  avatar: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 40,
    backgroundColor: COLORS.primary50,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary50,
  },
  avatarText: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: "500",
  },
  cameraBadge: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  errorText: { color: COLORS.danger, fontSize: 12, fontWeight: "800", marginTop: 10 },
  inlineError: { alignItems: "flex-start", gap: 8 },
  inlineRetryButton: { borderRadius: 7, backgroundColor: COLORS.primary50, paddingHorizontal: 12, paddingVertical: 8 },
  inlineRetryText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  form: {
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    minHeight: 44,
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedInput: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    backgroundColor: "#F7F8FA",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  lockedInputText: {
    color: COLORS.muted,
    fontSize: 14,
    fontWeight: "400",
  },
  selectInput: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 0.5,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectInputText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
  },
  selectPlaceholder: {
    color: COLORS.subtle,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "rgba(17,24,39,0.38)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 405,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
  },
  modalHandle: {
    width: 42,
    height: 4,
    alignSelf: "center",
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 18,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "500",
    marginBottom: 10,
  },
  modalOption: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#EAECEF",
  },
  modalOptionText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "400",
  },
  primaryButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginTop: 12,
  },
  disabledButton: {
    opacity: 0.55,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
});
