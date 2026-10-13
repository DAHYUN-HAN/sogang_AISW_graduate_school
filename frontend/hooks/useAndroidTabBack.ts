import { router, useFocusEffect, usePathname } from "expo-router";
import { useCallback, useLayoutEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

import { androidTabBackAction } from "../utils/androidTabBack";
import { navigateToTabRoot } from "../utils/tabNavigation";

export function useAndroidTabBack() {
  const pathname = usePathname();
  const current = useRef(pathname);
  useLayoutEffect(() => {
    current.current = pathname;
  }, [pathname]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        const action = androidTabBackAction(current.current, router.canGoBack());
        if (action === "home") {
          navigateToTabRoot("home");
          return true;
        }
        // Preserve detail-screen handlers; only Home may fall through to Android.
        return false;
      });

      return () => subscription.remove();
    // Keep this fallback older than focused screen/overlay handlers, including
    // after returning from a detail screen.
    }, []),
  );
}
