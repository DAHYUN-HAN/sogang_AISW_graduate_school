import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 카드를 Pressable로 감싸면 카드가 터치를 먼저 잡아 천천히 끄는 스크롤이 막힌다.
test("동의 시트 본문은 Pressable 안에 있지 않아 끌어서 스크롤된다", () => {
  const source = readFileSync("components/PrivacyConsentSheet.tsx", "utf8");
  assert.match(source, /<Pressable accessibilityLabel="닫기" onPress=\{onClose\} style=\{StyleSheet\.absoluteFill\} \/>\s+<View style=\{styles\.card\}>/);
  assert.doesNotMatch(source, /onPress=\{\(\) => undefined\}/);
});
