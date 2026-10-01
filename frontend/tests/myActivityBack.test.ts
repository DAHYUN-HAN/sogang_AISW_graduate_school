import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

import * as appRoutes from "../utils/appRoutes";

type Element = { type: string; props: Record<string, unknown> };
function findBack(node: unknown): Element | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) return node.map(findBack).find(Boolean);
  const element = node as Element;
  return element.props.accessibilityLabel === "뒤로" ? element : findBack(element.props.children);
}
function findList(node: unknown): Element | undefined {
  if (!node || typeof node !== "object") return undefined;
  if (Array.isArray(node)) return node.map(findList).find(Boolean);
  const element = node as Element;
  return element.type === "FlatList" ? element : findList(element.props.children);
}

for (const type of ["posts", "bookmarks", "comments"]) {
  test(`${type}: 목록의 < 한 번은 별도 마이페이지를 만들지 않고 공통 패널 복귀를 실행한다`, () => {
    const calls: string[] = [];
    const jsx = (type: string, props: Element["props"]) => ({ type, props });
    const modules: Record<string, unknown> = {
      "@expo/vector-icons": {},
      "@tanstack/react-query": { useInfiniteQuery: (options: { queryKey: string[] }) => {
        assert.deepEqual([...options.queryKey], ["activity", type]);
        return { data: { pages: [{ data: [] }] }, isLoading: false };
      } },
      "expo-router": { useLocalSearchParams: () => ({ type }), useFocusEffect: () => {},
        router: { replace: (route: string) => calls.push(`replace:${route}`),
          push: (route: string) => calls.push(`push:${route}`) } },
      react: { useState: (initial: () => unknown) => [initial(), () => {}], useEffect: () => {},
        useCallback: (callback: unknown) => callback },
      "react/jsx-runtime": { jsx, jsxs: jsx },
      "react-native": { View: "View", Pressable: "Pressable", Text: "Text", FlatList: "FlatList",
        StyleSheet: { create: (styles: unknown) => styles } },
      "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24 }) },
      "../../../components/LoadingState": { default: "LoadingState" },
      "../../../components/icons": { BackIcon: "BackIcon" },
      "../../../hooks/useReturnToMyPageDrawer": { useReturnToMyPageDrawer: (route: string) => {
        assert.equal(route, "/settings/activity");
        return { returnToMyPageDrawer: () => calls.push("return-to-drawer"), onLayout: () => calls.push("layout") };
      } },
      "../../../services/api": {}, "../../../utils/appRoutes": appRoutes,
      "../../../utils/dateFormat": { formatBoardDate: () => "26.09.10(목)" },
      "../../../utils/userActivityPresentation": { userActivityCategoryLabel: () => "기타공지" },
    };
    const exports = {} as { default: () => Element };
    const code = ts.transpileModule(readFileSync("app/(tabs)/settings/activity.tsx", "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    runInNewContext(code, { exports, require: (name: string) => {
      if (name.endsWith("/AppTypography")) return { AppText: "Text", AppTextInput: "TextInput" };
      assert.ok(name in modules, name); return modules[name];
    } });
    const tree = exports.default();
    (findBack(tree)!.props.onPress as () => void)();
    assert.deepEqual(calls, ["return-to-drawer"]);
    (tree.props.onLayout as () => void)();
    assert.deepEqual(calls, ["return-to-drawer", "layout"]);
    calls.length = 0;
    const renderItem = findList(tree)!.props.renderItem as (args: { item: Record<string, unknown> }) => Element;
    const row = renderItem({ item: { type: "post", post_id: 123, title: "게시글" } });
    (row.props.onPress as () => void)();
    assert.deepEqual(calls, [`push:/board/post/123?returnTo=${encodeURIComponent(`/(tabs)/settings/activity?type=${type}`)}`]);
  });
}
