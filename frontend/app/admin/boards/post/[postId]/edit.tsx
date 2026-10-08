import { Redirect, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { usePostDetail } from "../../../../../hooks/usePosts";
import { useAdminWorkspace } from "../../../../../components/admin/AdminWorkspace";
import AdminPostRouteState from "../../../../../components/admin/AdminPostRouteState";
import PostEditScreen from "../../../../(tabs)/board/post/edit/[postId]";

export default function AdminPostEditRoute() {
  const {postId} = useLocalSearchParams<{postId: string}>();
  const detail = usePostDetail(Number(postId), true, true);
  const {boards,boardsQuery} = useAdminWorkspace();
  const post = detail.data?.data;
  const board = boards.find(item => item.id === post?.board_id);
  if (Platform.OS !== "web") return <PostEditScreen />;
  const retry=()=>{void detail.refetch();void boardsQuery.refetch();};
  if (detail.isLoading || boardsQuery.isPending) return <AdminPostRouteState loading onRetry={retry} />;
  if (detail.isError || boardsQuery.isError || !post || !board) return <AdminPostRouteState onRetry={retry} />;
  if (board.board_type === "notice") {
    return <Redirect href={{pathname: "/admin/boards", params: {editNoticeId: String(post!.id)}}} />;
  }
  return <PostEditScreen />;
}
