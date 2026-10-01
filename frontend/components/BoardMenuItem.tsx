import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { AppText as Text } from "./AppTypography";

import type { Board } from "../types";

type Props = {
  board: Board;
  onPress: (board: Board) => void;
};

const BOARD_LABELS: Record<string, { name: string; description?: string }> = {
  "all-notices": { name: "전체 공지", description: "대학원과 원우회의 주요 공지를 한곳에서 확인하세요." },
  "academic-notices": { name: "학사공지", description: "등록, 수강, 학사 운영 관련 공지를 확인하세요." },
  "event-notices": { name: "행사공지", description: "원우회와 학과 행사의 최신 소식을 확인하세요." },
  "academic-calendar": { name: "학사 일정", description: "학사 일정과 일정 관련 안내를 확인하세요." },
  "webinar-notices": { name: "웨비나 특강 공지", description: "웨비나, 특강, 오픈 세션 정보를 확인하세요." },
  "event-album": { name: "행사 사진첩", description: "원우 모임과 행사 사진 기록을 둘러보세요." },
  "community-major": { name: "전공 커뮤니티", description: "전공 질문과 커뮤니티 이야기를 나눠보세요." },
  "community-exam": { name: "시험 자료", description: "시험 자료와 준비 노트를 공유하세요." },
  "community-comprehensive": { name: "종합시험 커뮤니티", description: "종합시험 준비 정보와 질문을 나눠보세요." },
  "community-review": { name: "강의후기 커뮤니티", description: "강의후기와 수강 경험을 공유하세요." },
  "community-paper": { name: "논문 자료 공유", description: "논문, 연구 자료, 참고 자료를 공유하세요." },
  "community-seminar": { name: "세미나 공유", description: "세미나 정보와 참여 후기를 공유하세요." },
  "community-job": { name: "채용 정보 공유", description: "취업, 인턴, 커리어 정보를 나눠보세요." },
  "club-apply": { name: "동아리 지원 신청", description: "동아리 참여 신청과 모집 글을 확인하세요." },
  "club-promo": { name: "동아리 홍보", description: "동아리 소개와 홍보 글을 둘러보세요." },
  "study-recruit": { name: "스터디 모집", description: "스터디 그룹 모집 글을 확인하세요." },
  "study-apply": { name: "스터디 지원 신청", description: "스터디 참여 신청과 관련 글을 확인하세요." },
  "alumni-photo": { name: "선후배 만남", description: "선후배 만남 사진과 기록을 둘러보세요." },
  "alumni-directory": { name: "동문 주소록", description: "멤버 명함 기반 동문 주소록 안내를 확인하세요." },
  "gsa-executives": { name: "원우회 임원진 소개", description: "원우회 임원진 소개와 명단을 확인하세요." },
  "gsa-cohort-leaders": { name: "기수별 기장단 소개", description: "기수별 기장단 소개와 인사말을 확인하세요." },
  "gsa-proposal": { name: "원우회 제안", description: "대학원 원우회에 제안사항을 남겨보세요." },
  "gsa-feedback": { name: "건의사항 피드백", description: "원우회 운영에 대한 의견과 피드백을 확인하세요." },
  "gsa-activity": { name: "원우회 활동", description: "대학원 원우회 활동 기록을 확인하세요." },
  "gsa-mutual-aid": { name: "원우회 상호부조", description: "원우회 상호부조 신청과 처리 상태를 확인하세요." },
  "gsa-faq": { name: "자주 묻는 질문", description: "원우회 관련 자주 묻는 질문을 확인하세요." },
  "gsa-roadmap-benefits": { name: "로드맵 & 원우회비 혜택", description: "원우회 로드맵과 원우회비 혜택 안내를 확인하세요." },
  "lecture-reviews": { name: "강의후기", description: "강의후기와 수강 경험을 공유하세요." },
  "exam-archive": { name: "시험족보", description: "시험 자료와 학습 자료를 공유하세요." },
  "comprehensive-exam": { name: "종합시험", description: "종합시험 정보와 준비 자료를 확인하세요." },
  "graduation-thesis": { name: "졸업논문", description: "졸업논문 정보와 준비 자료를 공유하세요." },
  "club-activity": { name: "동아리 활동 인증", description: "동아리 활동 인증 게시글을 작성하고 확인하세요." },
  "study-activity": { name: "스터디 활동 인증", description: "스터디 활동 인증 게시글을 작성하고 확인하세요." },
  "networking-activity": { name: "네트워킹 활동 인증", description: "멘토링과 네트워킹 활동 기록을 확인하세요." },
  "council-activity": { name: "원우회 활동내역", description: "원우회 활동과 결과를 확인하세요." },
  accounting: { name: "회계 장부", description: "원우회 회계와 예산 집행 자료를 확인하세요." },
  suggestions: { name: "건의사항", description: "건의사항을 남기고 공식 답변을 확인하세요." },
  "mutual-aid": { name: "상조모임", description: "경조사 신청과 처리 상태를 확인하세요." },
};

const BOARD_TYPE_LABELS: Record<string, string> = {
  album: "앨범",
  external_link: "외부 링크",
  faq: "FAQ",
  organization_intro: "소개",
  suggestion: "건의",
  notice: "공지",
  calendar: "일정",
  guide: "가이드",
  resource: "자료",
  activity_certification: "활동 인증",
  activity_history: "활동 내역",
  mutual_aid: "상조",
};

export default function BoardMenuItem({ board, onPress }: Props) {
  const label = BOARD_LABELS[board.slug];
  const name = label?.name ?? board.name;
  const description = label?.description ?? board.description;
  const typeLabel = BOARD_TYPE_LABELS[board.board_type];

  return (
    <Pressable onPress={() => onPress(board)}>
      <View
        style={{
          minHeight: 74,
          borderBottomWidth: 1,
          borderBottomColor: "#EEF0F3",
          backgroundColor: "#FFFFFF",
          paddingHorizontal: 2,
          paddingVertical: 13,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 }}>
              {typeLabel ? (
                <Text
                  style={{
                    color: "#2761FF",
                    fontSize: 11,
                    fontWeight: "900",
                    borderRadius: 6,
                    backgroundColor: "#EDF2FE",
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                  }}
                >
                  {typeLabel}
                </Text>
              ) : null}
              {board.write_permission === "admin" ? (
                <Text
                  style={{
                    color: "#D04444",
                    fontSize: 11,
                    fontWeight: "900",
                    borderRadius: 6,
                    backgroundColor: "#FFF1F2",
                    paddingHorizontal: 7,
                    paddingVertical: 3,
                  }}
                >
                  관리자
                </Text>
              ) : null}
            </View>
            <Text style={{ color: "#111827", fontSize: 16, fontWeight: "900", marginTop: 6 }} numberOfLines={1}>
              {name}
            </Text>
            {description ? (
              <Text style={{ color: "#6B7280", fontSize: 13, fontWeight: "700", lineHeight: 19, marginTop: 3 }} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9AA3B2" />
        </View>
      </View>
    </Pressable>
  );
}
