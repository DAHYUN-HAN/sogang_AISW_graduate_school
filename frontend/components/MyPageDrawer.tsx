import { router, usePathname } from "expo-router";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
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

import { BackIcon, ChevronRightIcon } from "./icons";
import { formatCohortName } from "../utils/userLabel";
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
  const edgeTouchStartXRef = useRef<number | null>(null);
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

  const edgePanResponder = useMemo(
    () =>
      PanResponder.create({
        // Observe edge drags from the parent without placing a touch surface over children.
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: (event) => {
          // gesture.x0 is not populated until grant, after the move-capture decision.
          edgeTouchStartXRef.current = event.nativeEvent.pageX;
          return false;
        },
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !isVisible
          && gesture.numberActiveTouches === 1
          && edgeTouchStartXRef.current !== null
          && edgeTouchStartXRef.current >= 0 && edgeTouchStartXRef.current < 24
          && gesture.dx > 14 && gesture.dx > Math.abs(gesture.dy) * 1.4,
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: (event) => {
          if (edgeTouchStartXRef.current !== null && event.nativeEvent.pageX - edgeTouchStartXRef.current > 36) {
            openDrawer();
          }
        },
      }),
    [isVisible, openDrawer]
  );

  const drawerPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          isVisible && gesture.dx < -12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.25,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -48) {
            closeDrawer();
          }
        },
      }),
    [closeDrawer, isVisible]
  );

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
      <View style={styles.host} {...edgePanResponder.panHandlers}>
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
                {...drawerPanResponder.panHandlers}
              >
                <View style={styles.appBar}>
                  <Pressable accessibilityLabel="닫기" onPress={closeDrawer} style={styles.iconButton}>
                    <BackIcon size={22} color={COLORS.text} />
                  </Pressable>
                  <Text style={styles.appBarTitle}>마이페이지</Text>
                  <View style={styles.appBarSpacer} />
                </View>

                <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
                  <Pressable onPress={() => navigateTo("/settings/profile")} style={styles.profileRow}>
                    <ProfileAvatar
                      mediaId={me?.profile_image_media_id}
                      mediaUrl={me?.profile_image_url}
                      size={52}
                    />
                    <View style={styles.profileText}>
                      {/* Figma 마이페이지 프로필: 1줄 "73기 최OO", 2줄 전공. 닉네임의 기수 접두사는 한 번만 표시한다. */}
                      <Text style={styles.profileName}>{me ? formatCohortName(me.cohort, me.nickname) : "로그인이 필요합니다"}</Text>
                      <Text style={styles.profileMeta}>{me?.major || me?.email || ""}</Text>
                    </View>
                    <ChevronRightIcon size={15} color={COLORS.subtle} />
                  </Pressable>
                  <View style={styles.divider} />

                  <View style={styles.menuList}>
                    {MENU_ITEMS.map((item, index) => (
                      <Pressable key={item.title} onPress={() => navigateTo(item.href)} style={[styles.menuRow, index === MENU_ITEMS.length - 1 ? styles.menuRowLast : null]}>
                        <Text style={styles.menuText}>{item.title}</Text>
                        <ChevronRightIcon size={15} color={COLORS.subtle} />
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
});
