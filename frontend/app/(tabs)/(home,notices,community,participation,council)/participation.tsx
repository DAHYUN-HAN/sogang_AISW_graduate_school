import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import BoardPostsScreen from "./board/[boardId]";
import LoadingState from "../../../components/LoadingState";
import { useLoadErrorOverlay } from "../../../components/NetworkErrorState";
import { useBoardsQuery } from "../../../hooks/useApi";
import { useTabRootResetStore } from "../../../stores/tabRootResetStore";
import { participationGroupDefaultSlug } from "../../../utils/appRoutes";

const COLORS = {
  bg: "#FFFFFF",
};

// 참여활동 탭은 동아리 홍보 게시판을 바로 연다. 동아리·스터디·네트워킹 전환은 게시판 화면이 맡는다.
const DEFAULT_BOARD_SLUG = participationGroupDefaultSlug("club");
// 목록은 받았지만 첫 게시판이 없을 때도 조회 실패와 같이 LoadError로 덮는다.
const MISSING_DEFAULT_BOARD = new Error("participation default board is missing");

export default function ParticipationScreen() {
  const resetRevision = useTabRootResetStore((state) => state.revisions.participation);

  return <ParticipationContent key={resetRevision} />;
}

function ParticipationContent() {
  const { data, isLoading, error, refetch } = useBoardsQuery();
  const defaultBoard = useMemo(
    () => data?.data.flatMap((group) => group.boards).find((board) => board.slug === DEFAULT_BOARD_SLUG),
    [data?.data],
  );
  const loadError = error ?? (!isLoading && !defaultBoard ? MISSING_DEFAULT_BOARD : null);
  useLoadErrorOverlay(loadError, () => void refetch());

  if (isLoading) {
    return <LoadingState />;
  }

  if (defaultBoard) {
    return <BoardPostsScreen initialBoardId={defaultBoard.id} />;
  }

  return <View style={styles.screen} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
