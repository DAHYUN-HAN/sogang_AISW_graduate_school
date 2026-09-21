import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// 구버전 앱 사용자에게 재가입을 알리는 안내. 두 가지 닫기가 서로 다르게 동작한다.
// ×는 이번 실행에서만 닫고, "다시 보지 않기"는 기기에 저장해 영구히 닫는다.
const HIDDEN_KEY = "aisw_migration_notice_hidden";

let dismissedThisRun = false;

/** ×와 배경 탭. 앱을 다시 켜면 또 떠야 해서 저장하지 않는다. */
export function dismissMigrationNoticeForNow() {
  dismissedThisRun = true;
}

export async function hideMigrationNoticeForever() {
  dismissedThisRun = true;
  try {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(HIDDEN_KEY, "1");
      return;
    }
    await SecureStore.setItemAsync(HIDDEN_KEY, "1");
  } catch {
    // 저장에 실패해도 이번 실행에서는 닫힌 상태를 유지한다.
  }
}

export async function isMigrationNoticeHidden() {
  if (dismissedThisRun) return true;
  try {
    if (Platform.OS === "web") {
      return typeof localStorage !== "undefined" && localStorage.getItem(HIDDEN_KEY) === "1";
    }
    return (await SecureStore.getItemAsync(HIDDEN_KEY)) === "1";
  } catch {
    // 저장소를 못 읽으면 안내를 띄우는 쪽을 택한다. 재가입 안내를 놓치면 로그인을 못 한다.
    return false;
  }
}
