import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  INITIAL_TAB_ROOT_RESET_REVISIONS,
  resetRevisionForTab,
  tabRootPressAction,
  type TabRootName,
  type VisibleTabRootName,
} from "../stores/tabRootResetStore";

const layoutSource = readFileSync("app/(tabs)/_layout.tsx", "utf8");
const noticesSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/notices.tsx", "utf8");
const communitySource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/community.tsx", "utf8");
const participationSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/participation.tsx", "utf8");

function tabScreenBlock(tabName: VisibleTabRootName) {
  // 탭마다 스택을 가진 공용 그룹이라 Tabs.Screen 이름은 "(home)"처럼 그룹 이름이다.
  const nameIndex = layoutSource.indexOf(`name="(${tabName})"`);
  assert.notEqual(nameIndex, -1, `${tabName} Tabs.Screen이 있어야 합니다.`);

  const blockStart = layoutSource.lastIndexOf("<Tabs.Screen", nameIndex);
  const nextBlockStart = layoutSource.indexOf("<Tabs.Screen", nameIndex + 1);
  return layoutSource.slice(blockStart, nextBlockStart === -1 ? undefined : nextBlockStart);
}

test("하단 탭 초기화 revision의 기본값은 세 대상 탭 모두 0이다", () => {
  assert.deepEqual(INITIAL_TAB_ROOT_RESET_REVISIONS, {
    notices: 0,
    community: 0,
    participation: 0,
  });
});

test("모든 하단 탭은 누를 때마다 자신의 루트 이동 액션을 만든다", () => {
  const expectedActions = [
    ["home", { route: "/(tabs)/home", resetTab: null }],
    ["notices", { route: "/(tabs)/notices", resetTab: "notices" }],
    ["community", { route: "/(tabs)/community", resetTab: "community" }],
    ["participation", { route: "/(tabs)/participation", resetTab: "participation" }],
    ["council", { route: "/(tabs)/council", resetTab: null }],
  ] as const;

  for (const [tabName, expected] of expectedActions) {
    assert.deepEqual(tabRootPressAction(tabName), expected);
  }
});

test("선택한 탭 revision만 증가시키고 다른 탭 및 기존 객체는 보존한다", () => {
  const current = { notices: 3, community: 5, participation: 8 };

  for (const tabName of ["notices", "community", "participation"] satisfies TabRootName[]) {
    const next = resetRevisionForTab(current, tabName);
    const expected = {
      ...current,
      [tabName]: current[tabName] + 1,
    };

    assert.deepEqual(next, expected);
    assert.notStrictEqual(next, current);
    assert.deepEqual(current, { notices: 3, community: 5, participation: 8 });
  }
});

test("다섯 하단 탭은 tabPress를 공통 루트 이동 처리기로 전달한다", () => {
  for (const tabName of ["home", "notices", "community", "participation", "council"] satisfies VisibleTabRootName[]) {
    const block = tabScreenBlock(tabName);
    assert.match(block, /listeners\s*=/, `${tabName}에 탭 이벤트 listener가 필요합니다.`);
    assert.match(block, /\btabPress\s*:/, `${tabName}은 tabPress만 처리해야 합니다.`);
    assert.match(block, new RegExp(`handleTabRootPress\\(["']${tabName}["']`));
  }

  assert.match(layoutSource, /event\.preventDefault\(\)/);
  assert.match(layoutSource, /tabRootPressAction/);
  assert.match(layoutSource, /requestTabRootReset\(action\.resetTab\)/);
  // router.navigate는 지금 탭 스택에 그 탭 화면을 한 번 더 쌓으므로 쓰지 않는다.
  assert.match(layoutSource, /navigateToTabRoot\(tabName\)/);
  assert.doesNotMatch(layoutSource, /router\.navigate\(/);
  assert.doesNotMatch(layoutSource, /navigation\.isFocused\(\)/);
});

test("focus나 blur 이벤트로는 탭 루트를 초기화하지 않는다", () => {
  assert.doesNotMatch(layoutSource, /\b(?:focus|blur)\s*:/);

  for (const source of [noticesSource, communitySource, participationSource]) {
    assert.doesNotMatch(source, /useFocusEffect/);
  }
});

test("세 탭 화면은 자신의 reset revision을 key로 소비해 로컬 상태와 스크롤을 재생성한다", () => {
  for (const [screenName, source] of [
    ["notices", noticesSource],
    ["community", communitySource],
    ["participation", participationSource],
  ] as const) {
    assert.match(source, /useTabRootResetStore/, `${screenName} 화면이 reset revision을 구독해야 합니다.`);
    assert.match(source, /key=\{resetRevision\}/, `${screenName} 화면이 reset revision을 key로 사용해야 합니다.`);
  }
});
