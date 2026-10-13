import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 계정 설정의 회원 탈퇴처럼 마이페이지도 마지막 메뉴(계정 설정) 아래에 구분선이 있어 로그아웃과 나뉜다.
test("마이페이지 마지막 메뉴도 아래 구분선을 그린다", () => {
  const source = readFileSync("app/(tabs)/(home,notices,community,participation,council)/settings/index.tsx", "utf8");
  assert.match(source, /onPress=\{\(\) => router\.push\(item\.href as never\)\} style=\{styles\.menuRow\}>/);
  assert.doesNotMatch(source, /menuRowLast/);
});
