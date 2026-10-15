import { router, useLocalSearchParams } from "expo-router";

import CompletionState from "../../../../../components/CompletionState";
import { postCreateCompletionRoute } from "../../../../../utils/appRoutes";
import { replaceWithRoute } from "../../../../../utils/tabNavigation";

function completionTitle(boardType?: string) {
  if (boardType === "suggestion") return "건의사항이 등록되었어요!";
  if (boardType === "mutual_aid") return "신청이 완료되었어요!";
  return "활동 인증이 등록되었어요!";
}

// 건의사항·상조회·활동 인증 등록 완료 화면. 글쓰기 화면 자리에 "확인"의 도착지를
// 깔고 그 위에 쌓이므로(postCompletionStack), 확인·안드로이드 뒤로가기·iOS 스와이프가
// 모두 이 화면만 빼서 같은 곳으로 돌아간다.
export default function PostCompleteScreen() {
  const params = useLocalSearchParams<{ boardType?: string; boardId?: string; postId?: string }>();
  const confirm = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // 아래 화면이 없을 때(웹 새로고침)만 도착지를 직접 연다.
    replaceWithRoute(postCreateCompletionRoute(params.boardType, Number(params.postId), Number(params.boardId)));
  };
  return <CompletionState title={completionTitle(params.boardType)} onConfirm={confirm} />;
}
