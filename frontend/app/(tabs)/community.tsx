import { Pressable, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";

import BoardPostsScreen from "./board/[boardId]";
import LoadingState from "../../components/LoadingState";
import { useBoardsQuery } from "../../hooks/useApi";
import { useTabRootResetStore } from "../../stores/tabRootResetStore";

const COLORS = {
  primary: "#2761FF",
  text: "#111827",
  muted: "#6B7280",
  bg: "#FFFFFF",
};

export default function CommunityScreen() {
  const resetRevision = useTabRootResetStore((state) => state.revisions.community);

  return <CommunityContent key={resetRevision} />;
}

function CommunityContent() {
  const { data, isLoading, isError, refetch } = useBoardsQuery();
  const boards = data?.data.flatMap((group) => group.boards) ?? [];
  const initialBoard =
    boards.find((board) => board.slug === "event-album") ??
    boards.find((board) => board.slug === "lecture-reviews") ??
    boards.find((board) => board.board_type === "resource");

  if (isLoading) {
    return <LoadingState message="커뮤니티를 불러오는 중이에요" />;
  }

  if (!initialBoard) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{isError ? "커뮤니티를 불러오지 못했습니다." : "연결된 커뮤니티 게시판이 없습니다."}</Text>
        <Text style={styles.message}>게시판 시드와 서버 연결 상태를 확인해주세요.</Text>
        {isError ? (
          <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return <BoardPostsScreen initialBoardId={initialBoard.id} isTabRoot />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 24,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center",
  },
  message: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  retryButton: {
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
