import { useRoute } from "@react-navigation/native";
import { useEffect } from "react";

import { tabNameFromRoute, useTabHighlightStore } from "../stores/tabHighlightStore";
import { boardParentRoute } from "../utils/appRoutes";

type BoardCategoryInfo = Parameters<typeof boardParentRoute>[0];

// 게시판·글 화면이 자기 라우트 키로 소속 탭을 기록한다. 화면이 스택에서 빠지면 지운다.
export function useBoardTabHighlight(board: BoardCategoryInfo) {
  const routeKey = useRoute().key;
  const setTab = useTabHighlightStore((state) => state.setTab);
  const clearTab = useTabHighlightStore((state) => state.clearTab);

  useEffect(() => {
    if (board) setTab(routeKey, tabNameFromRoute(boardParentRoute(board)));
  }, [board, routeKey, setTab]);

  useEffect(() => () => clearTab(routeKey), [clearTab, routeKey]);
}
