import { router, useLocalSearchParams } from "expo-router";

import CompletionState from "../../../../../components/CompletionState";
import { postCreateCompletionRoute } from "../../../../../utils/appRoutes";
import { replaceWithRoute } from "../../../../../utils/tabNavigation";

// 게시판 종류별 완료 문구. 표에 없는 게시판은 피그마 Screen/Community/WriteComplete 문구를 쓴다.
const COMPLETION_TITLES: Record<string, string> = {
  suggestion: "건의사항이 등록되었어요!",
  mutual_aid: "신청이 완료되었어요!",
  activity_certification: "활동 인증이 등록되었어요!",
};

function completionTitle(boardType?: string) {
  return COMPLETION_TITLES[boardType ?? ""] ?? "게시글이 등록되었어요!";
}

// 모든 게시판의 글 등록 완료 화면. 글쓰기 화면 자리에 "확인"의 도착지를
// 깔고 그 위에 쌓이므로(postCompletionStack), 확인·안드로이드 뒤로가기·iOS 스와이프가
// 모두 이 화면만 빼서 같은 곳으로 돌아간다.
export default function PostCompleteScreen() {
  const params = useLocalSearchParams<{ boardType?: string; boardId?: string; postId?: string; returnTo?: string }>();
  const confirm = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    // 아래 화면이 없을 때(웹 새로고침)만 도착지를 직접 연다.
    replaceWithRoute(postCreateCompletionRoute(params.boardType, Number(params.postId), Number(params.boardId), params.returnTo));
  };
  return <CompletionState title={completionTitle(params.boardType)} onConfirm={confirm} />;
}
