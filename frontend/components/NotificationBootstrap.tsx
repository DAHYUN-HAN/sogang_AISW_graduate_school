import Constants from "expo-constants";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, PanResponder, Platform, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText as Text } from "./AppTypography";

import { notificationApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import type { NotificationItem } from "../types";
import { notificationContentRoute } from "../utils/appRoutes";
import { setStoredPushToken } from "../utils/pushTokenStorage";
import { navigateToRoute, openTabStack } from "../utils/tabNavigation";
import { showWebNotification } from "../utils/webNotifications";
import { NoticeToastIcon } from "./icons";

declare const require: any;

const LAST_NOTIFICATION_KEY = "aisw_last_notification_id";
const POLL_INTERVAL_MS = 30_000;
// 앱 안 배너는 4초 뒤 사라진다. 그 전에 위·왼쪽·오른쪽으로 밀어서 치울 수도 있다.
const BANNER_AUTO_HIDE_MS = 4_000;
const BANNER_FADE_OUT_MS = 250;
const BANNER_SWIPE_UP_DISTANCE = 30;
const BANNER_SWIPE_SIDE_DISTANCE = 80;
const BANNER_SWIPE_VELOCITY = 0.5;
const useNativeDriver = Platform.OS !== "web";

type ExpoNotificationsModule = {
  setNotificationHandler?: (handler: unknown) => void;
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  getExpoPushTokenAsync: (options?: unknown) => Promise<{ data: string }>;
  setNotificationChannelAsync?: (channelId: string, channel: { name: string; importance: number; vibrationPattern?: number[]; lightColor?: string }) => Promise<unknown>;
  AndroidImportance?: { MAX?: number };
  addNotificationResponseReceivedListener?: (listener: (response: unknown) => void) => { remove: () => void };
};

function getStoredLatestId() {
  if (Platform.OS !== "web" || typeof localStorage === "undefined") {
    return 0;
  }
  return Number(localStorage.getItem(LAST_NOTIFICATION_KEY) ?? 0);
}

function storeLatestId(id: number) {
  if (Platform.OS === "web" && typeof localStorage !== "undefined") {
    localStorage.setItem(LAST_NOTIFICATION_KEY, String(id));
  }
}

function getExpoNotifications(): ExpoNotificationsModule | null {
  // Remote push is deferred for this release; keep the in-app polling below.
  if (Constants.expoConfig?.extra?.pushNotificationsEnabled !== true) {
    return null;
  }
  try {
    return require("expo-notifications") as ExpoNotificationsModule;
  } catch {
    return null;
  }
}

function getResponseData(response: any) {
  return response?.notification?.request?.content?.data ?? {};
}

async function markNotificationRead(notificationId: number) {
  try {
    await notificationApi.markRead(notificationId);
  } catch {
    // The notification can still be opened even if read-state sync fails.
  }
}

// 앱을 쓰다가 누른 알림(앱 안 배너·웹 알림 창)은 보던 탭 위에 글을 연다.
// 글 화면의 뒤로가기는 아래 화면을 먼저 꺼내므로 원래 보던 화면으로 돌아간다.
async function openNotificationOverCurrentScreen(notification: Pick<NotificationItem, "id" | "post_id" | "event_id">) {
  await markNotificationRead(notification.id);
  const route = notificationContentRoute(notification);
  if (route) navigateToRoute(route.split("?")[0]);
}

// 폰 푸시 알림을 눌러 앱이 열린 경우(지금은 푸시가 꺼져 있다).
async function openNotification(notification: Pick<NotificationItem, "id" | "post_id" | "event_id">) {
  await markNotificationRead(notification.id);

  const route = notificationContentRoute(notification);
  if (!route) return;
  // 알림으로 연 글의 뒤로가기는 알림 목록, 그다음 홈이다. 어느 탭에 있었든 그 순서를
  // 홈 탭 스택에 그대로 쌓아 iOS 스와이프도 같은 화면을 꺼내게 한다.
  const [path, query = ""] = route.split("?");
  const params: Record<string, string> = { postId: path.split("/").pop() ?? "" };
  for (const pair of query.split("&").filter(Boolean)) {
    const [key, value = ""] = pair.split("=");
    params[key] = decodeURIComponent(value);
  }
  openTabStack("home", [{ name: "notifications" }, { name: "board/post/[postId]", params }]);
}

async function registerPushToken() {
  if (Platform.OS === "web") {
    return;
  }

  const Notifications = getExpoNotifications();
  if (!Notifications) {
    return;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync?.("default", {
      name: "기본 알림",
      importance: Notifications.AndroidImportance?.MAX ?? 5,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2761FF",
    });
  }

  const currentPermission = await Notifications.getPermissionsAsync();
  let status = currentPermission.status;
  if (status !== "granted") {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== "granted") {
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    throw new Error("Expo project ID is missing.");
  }
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  await notificationApi.registerPushToken({ token: token.data, platform: Platform.OS });
  await setStoredPushToken(token.data);
  return token.data;
}

export default function NotificationBootstrap() {
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const latestSeenIdRef = useRef(getStoredLatestId());
  const initializedRef = useRef(false);
  const [visibleNotification, setVisibleNotification] = useState<NotificationItem | null>(null);
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = null;
    // 사라지는 중에 손가락으로 잡으면 다시 또렷하게 되돌린다.
    opacity.stopAnimation();
    opacity.setValue(1);
  }, [opacity]);
  const startHideTimer = useCallback(() => {
    stopHideTimer();
    hideTimerRef.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: BANNER_FADE_OUT_MS, useNativeDriver })
        .start(({ finished }) => { if (finished) setVisibleNotification(null); });
    }, BANNER_AUTO_HIDE_MS);
  }, [opacity, stopHideTimer]);

  useEffect(() => {
    if (!visibleNotification) return;
    drag.setValue({ x: 0, y: 0 });
    startHideTimer();
    return stopHideTimer;
  }, [visibleNotification, drag, startHideTimer, stopHideTimer]);

  const panResponder = useRef(PanResponder.create({
    // 탭은 Pressable이 받고, 손가락이 움직였을 때만 밀기로 가져온다.
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 || gesture.dy < -8,
    onPanResponderGrant: () => stopHideTimer(),
    onPanResponderMove: (_, gesture) => {
      const sideways = Math.abs(gesture.dx) > Math.abs(gesture.dy);
      drag.setValue(sideways ? { x: gesture.dx, y: 0 } : { x: 0, y: Math.min(gesture.dy, 0) });
    },
    onPanResponderRelease: (_, gesture) => {
      const sideways = Math.abs(gesture.dx) > Math.abs(gesture.dy);
      const width = Dimensions.get("window").width;
      const toValue = sideways
        ? Math.abs(gesture.dx) > BANNER_SWIPE_SIDE_DISTANCE || Math.abs(gesture.vx) > BANNER_SWIPE_VELOCITY
          ? { x: Math.sign(gesture.dx || gesture.vx) * width, y: 0 } : null
        : gesture.dy < -BANNER_SWIPE_UP_DISTANCE || gesture.vy < -BANNER_SWIPE_VELOCITY
          ? { x: 0, y: -200 } : null;
      if (toValue) {
        Animated.timing(drag, { toValue, duration: 150, useNativeDriver }).start(() => setVisibleNotification(null));
        return;
      }
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver }).start();
      startHideTimer();
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: { x: 0, y: 0 }, useNativeDriver }).start();
      startHideTimer();
    },
  })).current;

  const openVisibleNotification = async () => {
    if (!visibleNotification) {
      return;
    }
    const target = visibleNotification;
    setVisibleNotification(null);
    await openNotificationOverCurrentScreen(target);
  };

  useEffect(() => {
    const Notifications = getExpoNotifications();
    Notifications?.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    const subscription = Notifications?.addNotificationResponseReceivedListener?.((response) => {
      const data = getResponseData(response);
      const notificationId = Number(data.notification_id);
      const postId = data.post_id ? Number(data.post_id) : undefined;
      const eventId = data.event_id ? Number(data.event_id) : undefined;
      if (notificationId) {
        openNotification({ id: notificationId, post_id: postId, event_id: eventId });
      }
    });

    return () => {
      subscription?.remove();
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      initializedRef.current = false;
      return;
    }

    registerPushToken().catch(() => undefined);

    const poll = async () => {
      const response = await notificationApi.getNotifications(1, 1);
      const newest = response.data[0];
      if (!newest) {
        initializedRef.current = true;
        return;
      }

      if (!initializedRef.current) {
        initializedRef.current = true;
        const latestId = Math.max(latestSeenIdRef.current, newest.id);
        latestSeenIdRef.current = latestId;
        storeLatestId(latestId);
        return;
      }

      if (newest.id <= latestSeenIdRef.current || newest.is_read) {
        return;
      }

      latestSeenIdRef.current = newest.id;
      storeLatestId(newest.id);
      // 공지(notice) 알림만 화면 팝업(토스트/웹 알림)으로 띄운다.
      // 그 외(댓글·좋아요·일정·원우회 등)는 알림함에는 남기되 팝업은 띄우지 않는다.
      if (newest.notification_type !== "notice") {
        return;
      }
      setVisibleNotification(newest);
      if (Platform.OS === "web") {
        showWebNotification("AI·SW CAMPUS", newest.message, () => { void openNotificationOverCurrentScreen(newest); });
      }
    };

    poll().catch(() => undefined);
    const intervalId = setInterval(() => {
      poll().catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAuthenticated]);

  if (!visibleNotification) {
    return null;
  }

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        position: "absolute",
        // Sit below the status bar (clock, Wi-Fi) instead of over it.
        top: insets.top + 8,
        left: 12,
        right: 12,
        zIndex: 9999,
        elevation: 8,
        opacity,
        transform: drag.getTranslateTransform(),
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={openVisibleNotification}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: 14,
          borderWidth: 0.5,
          borderColor: "#E1E4E9",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 14,
          paddingVertical: 12,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <NoticeToastIcon size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: "#15171C", fontSize: 13, lineHeight: 16, fontWeight: "500" }}>
            AI·SW 캠퍼스
          </Text>
          <Text numberOfLines={1} style={{ color: "#6B7280", fontSize: 13, lineHeight: 16, fontWeight: "400" }}>
            {visibleNotification.message}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
