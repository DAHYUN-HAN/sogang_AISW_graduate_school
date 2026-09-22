import { router } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMeQuery } from "../../../hooks/useApi";
import ProfileAvatar from "../../../components/ProfileAvatar";
import { formatCohortName } from "../../../utils/userLabel";
import { authApi, notificationApi } from "../../../services/api";
import { useUserStore } from "../../../stores/userStore";
import { clearStoredPushToken, getStoredPushToken } from "../../../utils/pushTokenStorage";

import { BackIcon, ChevronRightIcon } from "../../../components/icons";
const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  avatar: "#EAF4FF",
  bg: "#FFFFFF",
  danger: "#E24B4A",
};

const MENU_ITEMS = [
  { title: "내가 쓴 글", href: "/settings/activity?type=posts" },
  { title: "스크랩한 글", href: "/settings/activity?type=bookmarks" },
  { title: "알림 설정", href: "/settings/notifications" },
  { title: "계정 설정", href: "/settings/account" },
] as const;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { data, isError, isLoading, refetch } = useMeQuery();
  const refreshToken = useUserStore((state) => state.refreshToken);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const clearSession = useUserStore((state) => state.clearSession);
  const me = data?.data;

  const logout = async () => {
    const pushToken = await getStoredPushToken().catch(() => null);
    if (pushToken) {
      await notificationApi.deactivatePushToken({ token: pushToken, platform: Platform.OS }).catch(() => undefined);
      await clearStoredPushToken().catch(() => undefined);
    }
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clearSession();
    router.replace("/auth/login");
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <Pressable
          accessibilityLabel="뒤로"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/home");
          }}
          style={styles.iconButton}
        >
          <BackIcon size={22} color={COLORS.text} />
        </Pressable>
        <Text style={styles.appBarTitle}>마이페이지</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        {isError ? (
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.loadErrorBox}>
            <Text style={styles.loadErrorText}>프로필을 불러오지 못했습니다. 다시 시도</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={() => router.push("/settings/profile")} style={styles.profileRow}>
          {isLoading ? (
            <View style={styles.avatar}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          ) : (
            <ProfileAvatar
              mediaId={me?.profile_image_media_id}
              mediaUrl={me?.profile_image_url}
              size={52}
            />
          )}
          <View style={styles.profileText}>
            {/* Figma 마이페이지 프로필: 1줄 "73기 최OO", 2줄 전공. 닉네임에 기수 접두사가 있으면 한 번만 표시한다. */}
            <Text style={styles.profileName}>{me ? formatCohortName(me.cohort, me.nickname) : "로그인이 필요합니다"}</Text>
            <Text style={styles.profileMeta}>{me?.major || me?.email || ""}</Text>
          </View>
          <ChevronRightIcon size={15} color={COLORS.subtle} />
        </Pressable>
        <View style={styles.divider} />

        <View style={styles.menuList}>
          {MENU_ITEMS.map((item, index) => (
            <Pressable key={item.title} onPress={() => router.push(item.href as never)} style={[styles.menuRow, index === MENU_ITEMS.length - 1 ? styles.menuRowLast : null]}>
              <Text style={styles.menuText}>{item.title}</Text>
              <ChevronRightIcon size={15} color={COLORS.subtle} />
            </Pressable>
          ))}
        </View>

        {isAuthenticated ? (
          <Pressable onPress={logout} style={styles.logoutRow}>
            <Text style={styles.logoutText}>로그아웃</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push("/auth/login")} style={styles.loginButton}>
            <Text style={styles.loginText}>로그인</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  // Figma TopBar: padding 18/16/14, 높이 54(18+22+14).
  appBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  iconButton: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  appBarSpacer: {
    width: 20,
    height: 20,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
    lineHeight: 21, // Figma 18/21
  },
  scroller: {
    flex: 1,
  },
  content: {
    paddingBottom: 36,
  },
  loadErrorBox: {
    borderRadius: 8,
    backgroundColor: "#FFF1F2",
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  loadErrorText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  // Figma 프로필래퍼: padding 0/16/16, 구분선은 별도 전폭 1px.
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: COLORS.avatar,
  },
  // Figma 프로필정보: 고정 폭(flex-grow 0)이라 셰브론이 텍스트 바로 뒤(gap 12)에 붙는다.
  profileText: {
    flexShrink: 1,
    minWidth: 0,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
    lineHeight: 19, // Figma 16/19
  },
  profileMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    lineHeight: 14, // Figma 12/14
    marginTop: 3,
  },
  // Figma 메뉴목록: padding 8/16/0, 행 43(13+17+13), 마지막 행은 테두리 없음.
  menuList: {
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 13,
  },
  menuRowLast: {
    borderBottomWidth: 0,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17, // Figma 14/17
  },
  logoutRow: {
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    marginTop: 8,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 17, // Figma 14/17
  },
  loginButton: {
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginHorizontal: 24,
    marginTop: 24,
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
});
