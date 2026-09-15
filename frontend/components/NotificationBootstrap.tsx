import { router } from "expo-router";
import Constants from "expo-constants";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { notificationApi } from "../services/api";
import { useUserStore } from "../stores/userStore";
import type { NotificationItem } from "../types";
import { notificationContentRoute } from "../utils/appRoutes";
import { setStoredPushToken } from "../utils/pushTokenStorage";
import { showWebNotification } from "../utils/webNotifications";
import { NoticeToastIcon } from "./icons";

declare const require: any;

const LAST_NOTIFICATION_KEY = "aisw_last_notification_id";
const POLL_INTERVAL_MS = 30_000;

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

async function openNotification(notification: Pick<NotificationItem, "id" | "post_id" | "event_id">) {
  try {
    await notificationApi.markRead(notification.id);
  } catch {
    // The notification can still be opened even if read-state sync fails.
  }

  router.push(notificationContentRoute(notification) as never);
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

  const openVisibleNotification = async () => {
    if (!visibleNotification) {
      return;
    }
    const target = visibleNotification;
    setVisibleNotification(null);
    await openNotification(target);
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
        showWebNotification("AI·SW CAMPUS", newest.message, () => { void openNotification(newest); });
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
    <Pressable
      accessibilityRole="button"
      onPress={openVisibleNotification}
      style={{
        position: "absolute",
        top: 8,
        left: 12,
        right: 12,
        zIndex: 9999,
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
  );
}
