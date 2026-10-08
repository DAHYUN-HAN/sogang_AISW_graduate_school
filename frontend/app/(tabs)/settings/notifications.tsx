import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { NetworkErrorFallback } from "../../../components/NetworkErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingState from "../../../components/LoadingState";
import { useReturnToMyPageDrawer } from "../../../hooks/useReturnToMyPageDrawer";
import { notificationApi } from "../../../services/api";
import { useUserStore } from "../../../stores/userStore";
import type { NotificationSettings } from "../../../types";

import { BackIcon } from "../../../components/icons";
function Toggle({ value, disabled, onValueChange }: { value: boolean; disabled?: boolean; onValueChange: (next: boolean) => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={[styles.toggleTrack, value ? styles.toggleTrackOn : styles.toggleTrackOff, disabled ? styles.toggleDisabled : null]}
    >
      <View style={styles.toggleThumb} />
    </Pressable>
  );
}

const COLORS = {
  primary: "#2761FF",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#A6ACB7",
  border: "#E1E4E9",
  bg: "#FFFFFF",
};

const DEFAULT_SETTINGS: NotificationSettings = {
  notify_comment: true,
  notify_like: true,
  notify_notice: true,
  notify_event: true,
  notify_council: true,
};

const SETTING_ROWS: { key: keyof NotificationSettings; label: string }[] = [
  { key: "notify_notice", label: "공지사항 알림" },
  { key: "notify_event", label: "일정 알림" },
  { key: "notify_comment", label: "커뮤니티 댓글 알림" },
  { key: "notify_council", label: "원우회 소식 알림" },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { returnToMyPageDrawer, onLayout } = useReturnToMyPageDrawer("/settings/notifications");
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [savingKey, setSavingKey] = useState<keyof NotificationSettings | null>(null);

  const loadSettings = useCallback(async () => {
    if (!isAuthenticated) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setIsError(false);
    setLoadError(null);
    try {
      const response = await notificationApi.getSettings();
      setSettings(response.data);
    } catch (error) {
      setLoadError(error);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSavingKey(key);
    try {
      const response = await notificationApi.updateSettings(next);
      setSettings(response.data);
    } catch {
      setSettings(settings);
      Alert.alert("저장 실패", "알림 설정을 저장하지 못했습니다.");
    } finally {
      setSavingKey(null);
    }
  };

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
        <Text style={styles.appBarTitle}>알림 설정</Text>
        <View style={styles.iconButton} />
      </View>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <NetworkErrorFallback error={loadError} onRetry={() => void loadSettings()}>
          <View style={styles.center}>
            <Text style={styles.errorText}>알림 설정을 불러오지 못했습니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadSettings()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        </NetworkErrorFallback>
      ) : (
        <View style={styles.list}>
          {SETTING_ROWS.map((row) => (
            <View key={row.key} style={styles.row}>
              <Text style={styles.rowText}>{row.label}</Text>
              <Toggle
                disabled={!isAuthenticated || savingKey === row.key}
                onValueChange={(value) => updateSetting(row.key, value)}
                value={settings[row.key]}
              />
            </View>
          ))}
          {!isAuthenticated ? (
            <Pressable onPress={() => router.replace("/auth/login")} style={styles.loginButton}>
              <Text style={styles.loginButtonText}>로그인 후 설정하기</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 14,
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
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  errorText: {
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
  list: {
    paddingTop: 4,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
    paddingVertical: 13,
  },
  rowText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
  },
  toggleTrack: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackOn: { backgroundColor: COLORS.primary, alignItems: "flex-end" },
  toggleTrackOff: { backgroundColor: "#D1D5DB", alignItems: "flex-start" },
  toggleDisabled: { opacity: 0.5 },
  toggleThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
  },
  loginButton: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    marginTop: 22,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "500",
  },
});
