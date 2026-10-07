import { Redirect, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { useAdminWorkspace } from "../../../components/admin/AdminWorkspace";
import AdminPostRouteState from "../../../components/admin/AdminPostRouteState";
import PostCreateScreen from "../../(tabs)/(home,notices,community,participation,council)/board/post/create";

export default function AdminPostCreateRoute() {
  const {boardId} = useLocalSearchParams<{boardId: string}>();
  const {boards,boardsQuery} = useAdminWorkspace();
  const board = boards.find(item => item.id === Number(boardId));
  if (Platform.OS !== "web") return <PostCreateScreen />;
  const retry=()=>{void boardsQuery.refetch();};
  if (boardsQuery.isPending) return <AdminPostRouteState loading onRetry={retry} />;
  if (boardsQuery.isError || !board) return <AdminPostRouteState onRetry={retry} />;
  if (board?.board_type === "notice") {
    return <Redirect href={{pathname: "/admin/boards", params: {createNoticeBoardId: String(board.id)}}} />;
  }
  return <PostCreateScreen />;
}
