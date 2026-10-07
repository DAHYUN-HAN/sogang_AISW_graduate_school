import { router, useFocusEffect, usePathname } from "expo-router";
import { useCallback, useLayoutEffect, useRef } from "react";
import { BackHandler, Platform } from "react-native";

import { androidTabBackAction } from "../utils/androidTabBack";
import { navigateToTabRoot } from "../utils/tabNavigation";

export function useAndroidTabBack(drawerOpen: boolean, closeDrawer: () => void) {
  const pathname = usePathname();
  const current = useRef({ pathname, drawerOpen, closeDrawer });
  useLayoutEffect(() => {
    current.current = { pathname, drawerOpen, closeDrawer };
  }, [pathname, drawerOpen, closeDrawer]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        const { pathname, drawerOpen, closeDrawer } = current.current;
        const action = androidTabBackAction(pathname, router.canGoBack(), drawerOpen);
        if (action === "close-drawer") {
          closeDrawer();
          return true;
        }
        if (action === "home") {
          navigateToTabRoot("home");
          return true;
        }
        // Preserve detail-screen handlers; only Home may fall through to Android.
        return false;
      });

      return () => subscription.remove();
    // Keep this fallback older than focused screen/overlay handlers, including
    // after returning from a detail or closing the native My Page modal.
    }, []),
  );
}
