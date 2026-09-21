import { Ionicons } from "@expo/vector-icons";
import { router, usePathname } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useMeQuery } from "../hooks/useApi";
import { useAndroidTabBack } from "../hooks/useAndroidTabBack";
import ProfileAvatar from "./ProfileAvatar";
import { authApi, notificationApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import {
  MY_PAGE_DRAWER_SETTINGS_ROUTES,
  type MyPageDrawerSettingsRoute,
  type MyPageOriginRoute,
  myPageOriginOrHome,
  myPageOriginRoute,
  navigateBackToMyPageDrawer,
} from "../utils/myPageNavigation";
import { clearStoredPushToken, getStoredPushToken } from "../utils/pushTokenStorage";

import { BackIcon } from "./icons";
import MyPageDrawerOverlay from "./MyPageDrawerOverlay";
const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  primary100: "#D5E0FE",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
  danger: "#E24B4A",
  backdrop: "rgba(17,24,39,0.24)",
};

const MENU_ITEMS = [
  { title: "내가 쓴 글", href: "/settings/activity?type=posts" },
  { title: "스크랩한 글", href: "/settings/activity?type=bookmarks" },
  { title: "알림 설정", href: "/settings/notifications" },
  { title: "계정 설정", href: "/settings/account" },
] as const;

type MyPageDrawerContextValue = {
  openDrawer: () => void;
  closeDrawer: () => void;
  returnToDrawer: () => void;
  settingsDidLayout: (route: MyPageDrawerSettingsRoute) => void;
};

const MyPageDrawerContext = createContext<MyPageDrawerContextValue | null>(null);

export function useMyPageDrawer() {
  const context = useContext(MyPageDrawerContext);
  if (!context) {
    throw new Error("useMyPageDrawer must be used within MyPageDrawerProvider");
  }
  return context;
}

export function MyPageDrawerProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data } = useMeQuery();
  const refreshToken = useUserStore((state) => state.refreshToken);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const clearSession = useUserStore((state) => state.clearSession);
  const [isVisible, setIsVisible] = useState(false);
  const drawerWidth = width;
  const translateX = useRef(new Animated.Value(-drawerWidth)).current;
  const returningToDrawerRef = useRef(false);
  const pendingDrawerShownRef = useRef<(() => void) | null>(null);
  const pendingSettingsRef = useRef<MyPageDrawerSettingsRoute | null>(null);
  const lastMountedOriginRef = useRef<MyPageOriginRoute | null>(null);
  const drawerOriginRef = useRef<MyPageOriginRoute | null>(null);
  const me = data?.data;

  useEffect(() => {
    const origin = myPageOriginRoute(pathname);
    if (!origin) return;
    lastMountedOriginRef.current = origin;
    if (!isVisible) drawerOriginRef.current = null;
  }, [isVisible, pathname]);

  useEffect(() => {
    if (!isVisible) {
      translateX.setValue(-drawerWidth);
    }
  }, [drawerWidth, isVisible, translateX]);

  const closeDrawer = useCallback(() => {
    if (pendingSettingsRef.current || returningToDrawerRef.current) return;
    Animated.timing(translateX, {
      toValue: -drawerWidth,
      duration: 180,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setIsVisible(false);
    });
  }, [drawerWidth, translateX]);

  useAndroidTabBack(isVisible, closeDrawer);

  const showDrawer = useCallback((animate = true) => {
    if (!isAuthenticated) {
      router.push("/auth/login" as never);
      return;
    }
    translateX.stopAnimation();
    translateX.setValue(animate ? -drawerWidth : 0);
    setIsVisible(true);
    if (!animate) return;
    Animated.timing(translateX, {
      toValue: 0,
      duration: 210,
      useNativeDriver: true,
    }).start();
  }, [drawerWidth, isAuthenticated, translateX]);

  const openDrawer = useCallback(() => {
    drawerOriginRef.current = myPageOriginRoute(pathname) ?? lastMountedOriginRef.current;
    showDrawer();
  }, [pathname, showDrawer]);

  const returnToDrawer = useCallback(() => {
    if (returningToDrawerRef.current) return;
    returningToDrawerRef.current = true;
    const returnOrigin = myPageOriginOrHome(drawerOriginRef.current);
    navigateBackToMyPageDrawer(
      returnOrigin,
      {
        navigate: (route) => router.navigate(route as never),
      },
      (onShown) => {
        drawerOriginRef.current = returnOrigin;
        pendingDrawerShownRef.current = () => {
          onShown();
          returningToDrawerRef.current = false;
        };
        showDrawer(false);
      },
    );
  }, [showDrawer]);

  const drawerDidShow = useCallback(() => {
    const onShown = pendingDrawerShownRef.current;
    pendingDrawerShownRef.current = null;
    onShown?.();
  }, []);

  const settingsDidLayout = useCallback((route: MyPageDrawerSettingsRoute) => {
    if (pendingSettingsRef.current !== route) return;
    pendingSettingsRef.current = null;
    setIsVisible(false);
  }, []);

  const navigateTo = (href: string) => {
    if (pendingSettingsRef.current || returningToDrawerRef.current) return;
    const route = href.split("?")[0] as MyPageDrawerSettingsRoute;
    if (MY_PAGE_DRAWER_SETTINGS_ROUTES.includes(route)) {
      // The edge gesture can open the drawer over this very settings screen.
      if (href === pathname) {
        setIsVisible(false);
        return;
      }
      pendingSettingsRef.current = route;
      translateX.stopAnimation();
      translateX.setValue(0);
      router.push(href as never);
      return;
    }
    closeDrawer();
    setTimeout(() => router.push(href as never), 170);
  };

  const logout = async () => {
    if (pendingSettingsRef.current || returningToDrawerRef.current) return;
    closeDrawer();
    const pushToken = await getStoredPushToken().catch(() => null);
    if (pushToken) {
      await notificationApi.deactivatePushToken({ token: pushToken, platform: Platform.OS }).catch(() => undefined);
      await clearStoredPushToken().catch(() => undefined);
    }
    if (refreshToken) {
      await authApi.logout(refreshToken).catch(() => undefined);
    }
    clearSession();
    setTimeout(() => router.replace("/auth/login" as never), 170);
  };

  const backdropOpacity = translateX.interpolate({
    inputRange: [-drawerWidth, 0],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const contextValue = useMemo(
    () => ({ openDrawer, closeDrawer, returnToDrawer, settingsDidLayout }),
    [closeDrawer, openDrawer, returnToDrawer, settingsDidLayout],
  );

  return (
    <MyPageDrawerContext.Provider value={contextValue}>
      {/* 서랍에는 스와이프 제스처를 두지 않는다. 여는 쪽(왼쪽 가장자리 드래그)은
          iOS의 기본 스와이프 뒤로가기와 같은 구역(왼쪽 약 25pt)을 놓고 다퉜고,
          네이티브 제스처 인식기는 JS 반응자가 막을 수 없어 뒤로가기와 서랍이
          번갈아 걸렸다. 지금은 서랍뿐 아니라 스택도 스와이프를 쓰지 않는다.
          여는 것은 헤더의 마이페이지 버튼, 닫는 것은 서랍의 닫기 버튼(과
          안드로이드 시스템 뒤로가기)뿐이다. 서랍이 화면을 꽉 채워서 뒤 배경은
          눌리지 않는다. */}
      <View style={styles.host}>
        {children}
        {isVisible ? (
          <MyPageDrawerOverlay onClose={closeDrawer} onShow={drawerDidShow}>
            <View
              pointerEvents="box-none"
              style={styles.overlay}
              onLayout={Platform.OS === "android" ? undefined : drawerDidShow}
            >
              <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <Pressable accessibilityLabel="마이페이지 닫기" onPress={closeDrawer} style={StyleSheet.absoluteFill} />
              </Animated.View>
              <Animated.View
                style={[
                  styles.drawer,
                  {
                    width: "100%",
                    paddingTop: Math.max(insets.top, 10),
                    transform: [{ translateX }],
                  },
                ]}
              >
                <View style={styles.appBar}>
                  <Pressable accessibilityLabel="닫기" onPress={closeDrawer} style={styles.iconButton}>
                    <BackIcon size={24} color={COLORS.text} />
                  </Pressable>
                  <Text style={styles.appBarTitle}>마이페이지</Text>
                  <View style={styles.iconButton} />
                </View>

                <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
                  <Pressable onPress={() => navigateTo("/settings/profile")} style={styles.profileRow}>
                    <ProfileAvatar
                      mediaId={me?.profile_image_media_id}
                      mediaUrl={me?.profile_image_url}
                      size={52}
                    />
                    <View style={styles.profileText}>
                      <Text style={styles.profileName}>{me?.nickname ?? "로그인이 필요합니다"}</Text>
                      <Text style={styles.profileMeta}>
                        {[me?.major, me?.cohort ? `${me.cohort}기` : null].filter(Boolean).join(" · ") || me?.email || ""}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
                  </Pressable>

                  <View style={styles.menuList}>
                    {MENU_ITEMS.map((item) => (
                      <Pressable key={item.title} onPress={() => navigateTo(item.href)} style={styles.menuRow}>
                        <Text style={styles.menuText}>{item.title}</Text>
                        <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
                      </Pressable>
                    ))}
                  </View>

                  <Pressable onPress={logout} style={styles.logoutRow}>
                    <Text style={styles.logoutText}>로그아웃</Text>
                  </Pressable>
                </ScrollView>
              </Animated.View>
            </View>
          </MyPageDrawerOverlay>
        ) : null}
      </View>
    </MyPageDrawerContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.backdrop,
  },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.bg,
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
    paddingBottom: 36,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  profileText: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },
  profileMeta: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "400",
    marginTop: 3,
  },
  menuList: {
    marginTop: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  menuText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
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
  },
});
