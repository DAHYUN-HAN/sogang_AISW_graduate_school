import { useFonts } from "expo-font";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, useWindowDimensions, View } from "react-native";

import NotificationBootstrap from "../components/NotificationBootstrap";
import StatusBarScrim from "../components/StatusBarScrim";
import KeyboardViewport from "../components/KeyboardViewport";
import { useUserStore } from "../stores/userStore";
import { APP_FONTS, patchDefaultFontFamily } from "../utils/fonts";
import { isAdminUser } from "../utils/permissions";
import { MINIMUM_SPLASH_DURATION_MS, shouldShowSplash } from "../utils/splash";

// Keep the native launch screen until the ready navigator has laid out.
if (Platform.OS !== "web") {
  void SplashScreen.preventAutoHideAsync();
}

// Route every <Text>/<TextInput> through the matching Pretendard face (design uses Inter + Korean fallback).
patchDefaultFontFamily();

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient());
  const [minimumSplashDurationElapsed, setMinimumSplashDurationElapsed] = useState(false);
  const { width } = useWindowDimensions();
  const [fontsLoaded] = useFonts(APP_FONTS);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const hasHydrated = useUserStore((state) => state.hasHydrated);
  const hydrateSession = useUserStore((state) => state.hydrateSession);
  const user = useUserStore((state) => state.user);
  const isAdmin = isAdminUser(user);
  const isWeb = Platform.OS === "web";
  const useWebFrame = isWeb && width > 430;

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMinimumSplashDurationElapsed(true);
    }, MINIMUM_SPLASH_DURATION_MS);

    return () => clearTimeout(timeoutId);
  }, []);

  if (
    shouldShowSplash({
      hasHydrated,
      fontsLoaded,
      minimumDurationElapsed: minimumSplashDurationElapsed,
    })
  ) {
    // Replaying the full-screen artwork changes the native logo's size on launch.
    if (!isWeb) return null;

    return (
      <View style={styles.splash}>
        <Image source={require("../assets/splash-logo.png")} resizeMode="contain" style={styles.splashLogo} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View
        style={[styles.viewport, useWebFrame ? styles.webViewport : null]}
        onLayout={isWeb ? undefined : SplashScreen.hide}
      >
        <KeyboardViewport style={[styles.appShell, useWebFrame ? styles.webAppShell : null]}>
          <StatusBar style="dark" />
          <NotificationBootstrap />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: "#ffffff" },
              headerTitleStyle: { color: "#111827", fontWeight: "900" },
              contentStyle: { backgroundColor: "#FFFFFF" },
              statusBarStyle: "dark",
            }}
          >
            {/* Protected routes fall back to the first available screen, so keep login first for guests. */}
            <Stack.Protected guard={!isAuthenticated}>
              <Stack.Screen name="auth/login" options={{ headerShown: false }} />
              <Stack.Screen name="auth/register" options={{ headerShown: false }} />
              <Stack.Screen name="auth/password-reset" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={isAuthenticated}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            </Stack.Protected>
            <Stack.Protected guard={isAdmin}>
              <Stack.Screen name="admin/index" options={{ title: "관리자" }} />
            </Stack.Protected>
            <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
            <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
            <Stack.Screen name="legal/account-deletion" options={{ headerShown: false }} />
            <Stack.Screen name="legal/support" options={{ headerShown: false }} />
          </Stack>
          <StatusBarScrim />
        </KeyboardViewport>
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF2FE", // app.json splash.backgroundColor와 같은 값
  },
  splashLogo: {
    width: "100%",
    height: "100%",
  },
  viewport: {
    flex: 1,
    backgroundColor: "#F7F8FA",
  },
  webViewport: {
    alignItems: "center",
    backgroundColor: "#ECEFF5",
  },
  appShell: {
    flex: 1,
    width: "100%",
    backgroundColor: "#FFFFFF",
  },
  webAppShell: {
    maxWidth: 405,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#E1E4E9",
  },
});
