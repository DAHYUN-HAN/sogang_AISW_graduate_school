import { Redirect, useLocalSearchParams } from "expo-router";
import { Platform } from "react-native";
import { usePostDetail } from "../../../../../hooks/usePosts";
import { useAdminWorkspace } from "../../../../../components/admin/AdminWorkspace";
import AdminPostRouteState from "../../../../../components/admin/AdminPostRouteState";
// 글 수정은 글쓰기 화면의 수정 모드를 쓴다(주소의 postId로 수정 모드가 된다).
import PostEditScreen from "../../../../(tabs)/(home,notices,community,participation,council)/board/post/create";

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
