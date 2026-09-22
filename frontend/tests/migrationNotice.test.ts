import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const storageSource = readFileSync("utils/migrationNotice.ts", "utf8");
const modalSource = readFileSync("components/MigrationNoticeModal.tsx", "utf8");
const loginSource = readFileSync("app/auth/login.tsx", "utf8");

test("×는 이번 실행만 닫고 다시 보지 않기는 기기에 저장한다", () => {
  // 저장 키가 바뀌면 이미 닫은 사용자에게 안내가 다시 뜬다.
  assert.match(storageSource, /const HIDDEN_KEY = "aisw_migration_notice_hidden"/);
  // ×는 메모리 플래그만 올린다. 저장까지 하면 앱을 다시 켜도 안 뜬다.
  assert.match(storageSource, /export function dismissMigrationNoticeForNow\(\) \{\r?\n\s+dismissedThisRun = true;\r?\n\}/);
  assert.match(storageSource, /export async function hideMigrationNoticeForever/);
  // 세션 저장소와 같은 방식으로 웹에서는 localStorage를 쓴다.
  assert.match(storageSource, /Platform\.OS === "web"/);
});

test("저장소를 못 읽으면 안내를 띄운다", () => {
  // 재가입 안내를 놓치면 구버전 사용자는 로그인 자체를 못 한다.
  assert.match(storageSource, /\} catch \{[\s\S]*?return false;\r?\n\s+\}/);
});

test("문구와 디자인 값은 Figma 1329:45를 따른다", () => {
  assert.match(modalSource, /새로워진 AI·SW CAMPUS를 만나보세요/);
  // 본문은 두 줄이다. 줄바꿈이 빠지면 한 줄로 붙어 버린다.
  assert.ok(modalSource.includes("기존 앱 사용자도 새로 가입이 필요해요."), "본문 1행 누락");
  assert.ok(modalSource.includes(".\\n학교 이메일로 30초면 끝!"), "본문 2행 또는 줄바꿈 누락");
  assert.match(modalSource, /회원가입 하러 가기/);
  assert.match(modalSource, /다시 보지 않기/);
  assert.match(modalSource, /const CARD_WIDTH = 300/);
  // 뒤가 비치면 안 된다. rgba(0,0,0,0.5)를 흰 바탕에 합성한 통회색이다.
  assert.match(modalSource, /backgroundColor: "#808080"/);
  assert.doesNotMatch(modalSource, /rgba\(0, 0, 0, 0\.5\)/);
  // 상태바·내비게이션바 영역까지 덮어야 흰 띠가 남지 않는다.
  assert.match(modalSource, /statusBarTranslucent navigationBarTranslucent/);
  assert.match(modalSource, /borderRadius: 16/);
  // 카드 안쪽 여백 24/20/20과 블록 사이 10
  assert.match(modalSource, /paddingTop: 24,\r?\n\s+paddingBottom: 20,\r?\n\s+gap: 10,/);
  // 버튼 48h / r8 / #2761FF
  assert.match(modalSource, /primary: "#2761FF"/);
  assert.match(modalSource, /height: 48,[\s\S]*?borderRadius: 8,\r?\n\s+backgroundColor: COLORS\.primary,/);
});

test("로그인 화면이 안내를 띄우고 세 가지 닫기를 구분한다", () => {
  assert.match(loginSource, /<MigrationNoticeModal/);
  assert.match(loginSource, /void isMigrationNoticeHidden\(\)\.then\(\(hidden\) => \{/);
  // ×와 회원가입 이동은 이번 실행만, 다시 보지 않기는 영구.
  assert.match(loginSource, /onClose=\{\(\) => \{\r?\n\s+dismissMigrationNoticeForNow\(\);/);
  assert.match(loginSource, /onRegister=\{\(\) => \{\r?\n\s+dismissMigrationNoticeForNow\(\);/);
  assert.match(loginSource, /router\.push\("\/auth\/register"\);/);
  assert.match(loginSource, /onHideForever=\{\(\) => \{\r?\n\s+void hideMigrationNoticeForever\(\);/);
});
