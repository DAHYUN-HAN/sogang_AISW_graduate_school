import { ActivityIndicator, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { AdminBoardTargetQueryState } from "../../../components/admin/AdminBoardContentPanel";
import { AdminPostCard, COLORS, MetricCard, Panel, ShortcutCard, formatDate } from "../AdminControls";
import { useAdminWorkspace } from "../AdminWorkspace";

import AdminColumns from "../AdminColumns";
export default function AdminDashboardLegacy() {
  const { activeBannerCount, adminPostTotal, adminPosts, adminPostsQuery, auditLogs, auditLogsQuery, banners, boardsQuery, clubPromoBoard, cohortLeaders, councilBoardCount, currentCouncils, dispatchEventReminders, events, faqs, handleDeleteAdminPost, handlePinAdminPost, networkingProgramsBoard, noticeBoards, openAdminSection, openAllManagedPosts, openManagedBoard, pastCouncils, pendingBoardNavigationIntent, pendingSuggestionCount, processingMutualAidCount, stats, syncPushReceipts, users } = useAdminWorkspace();
  return (<View style={{ gap: 12 }}>
    <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600" }}>운영 바로가기</Text>
    <AdminBoardTargetQueryState
      status={boardsQuery.isPending ? "loading" : boardsQuery.isError ? "error" : "aggregate"}
      onRetry={() => void boardsQuery.refetch()}
    />
    {pendingBoardNavigationIntent ? (
      <Text accessibilityLiveRegion="polite" style={{ color: COLORS.muted, fontSize: 12 }}>
        게시판 목록을 확인한 뒤 요청한 바로가기로 이동합니다.
      </Text>
    ) : null}
    <AdminColumns compact>
      <ShortcutCard
        icon="albums-outline"
        title="배너 등록 · 미리보기"
        description="홈 화면에 노출되는 배너 이미지를 등록하고 모바일 미리보기를 확인합니다."
        meta={`노출 ${activeBannerCount}개 / 전체 ${banners.length}개`}
        onPress={() => openAdminSection("banners")}
      />
      <ShortcutCard
        icon="megaphone-outline"
        title="공지사항 등록"
        description="학사공지, 행사공지 등 관리자 전용 공지 게시판에 새 공지를 작성합니다."
        meta={`${noticeBoards.length}개 공지 게시판 관리`}
        onPress={() => openManagedBoard("all-notices")}
      />
      <ShortcutCard
        icon="people-circle-outline"
        title="원우회 게시판 설정"
        description="활동내역, 회계장부, 상조회 같은 원우회 메뉴 게시판의 권한과 노출을 관리합니다."
        meta={`${councilBoardCount}개 원우회 게시판 설정`}
        onPress={() => openManagedBoard("council-activity", "settings")}
      />
      <ShortcutCard
        icon="people-circle-outline"
        title="원우회 소개 등록"
        description="현재 원우회의 대표 이미지, 인사말, 소개글과 임원 카드를 등록합니다."
        meta={currentCouncils[0]?.members.length ? `${currentCouncils[0].members.length}개 임원 카드 등록` : "등록 필요"}
        onPress={() => openManagedBoard("gsa-executives")}
      />
      <ShortcutCard
        icon="ribbon-outline"
        title="기수별 기장단 등록"
        description="기장·부기장 이름, 소개글과 대표·프로필 이미지를 관리자 전용으로 등록합니다."
        meta={`${cohortLeaders.length}개 기수 등록`}
        onPress={() => openManagedBoard("gsa-cohort-leaders")}
      />
      <ShortcutCard
        icon="time-outline"
        title="역대 원우회 관리"
        description="역대 원우회 임원진, 소개와 활동내역을 별도 관리합니다."
        meta={`${pastCouncils.length}개 원우회 등록`}
        onPress={() => openManagedBoard("gsa-past-councils")}
      />
      <ShortcutCard
        icon="document-text-outline"
        title="전체 게시글 관리"
        description="전체 게시글을 검색하고 고정, 수정, 삭제 같은 운영 작업을 처리합니다."
        meta={`${adminPostTotal}개 게시글 조회`}
        onPress={openAllManagedPosts}
      />
      <ShortcutCard
        icon="flower-outline"
        title="상조회 신청 처리"
        description="신청 내용과 비공개 증빙서류를 확인하고 처리 완료 또는 반려로 변경합니다."
        meta={`처리 대기 ${processingMutualAidCount}건`}
        onPress={() => openManagedBoard("mutual-aid")}
      />
      <ShortcutCard
        icon="chatbox-ellipses-outline"
        title="건의사항 답변"
        description="익명 건의사항을 확인하고 원우회 공식 답변을 등록합니다."
        meta={`답변 대기 ${pendingSuggestionCount}건`}
        onPress={() => openManagedBoard("suggestions")}
      />
      <ShortcutCard
        icon="people-outline"
        title="동아리 게시글 등록"
        description="대표 사진과 가입 신청 링크를 포함한 동아리 소개 글을 등록합니다."
        meta={clubPromoBoard ? "관리자 전용 게시판" : "동아리 게시판 확인 필요"}
        onPress={() => openManagedBoard("club-promo")}
      />
      <ShortcutCard
        icon="git-network-outline"
        title="네트워킹 게시글 등록"
        description="대표 사진과 참가 신청 링크를 포함한 네트워킹 안내 글을 등록합니다."
        meta={networkingProgramsBoard ? "관리자 전용 게시판" : "네트워킹 게시판 확인 필요"}
        onPress={() => openManagedBoard("networking-programs")}
      />
      <ShortcutCard
        icon="help-circle-outline"
        title="FAQ 관리"
        description="FAQ 목록, 정렬 순서와 노출 상태를 관리합니다."
        meta={`${faqs.length}개 FAQ`}
        onPress={() => openManagedBoard("gsa-faq")}
      />
      <ShortcutCard
        icon="calendar-outline"
        title="일정 관리"
        description="학사 일정과 원우회 일정을 등록하고 수정합니다."
        meta={`${events.length}개 일정`}
        onPress={() => openManagedBoard("academic-calendar")}
      />
      <ShortcutCard
        icon="notifications-outline"
        title="D-day 알림 실행"
        description="오늘과 내일 일정을 확인해 중복 없이 D-day/D-1 알림을 생성합니다."
        meta="스케줄러 수동 실행"
        onPress={() => void dispatchEventReminders()}
      />
      <ShortcutCard
        icon="cloud-done-outline"
        title="푸시 전송 결과 확인"
        description="Expo Push 영수증을 동기화하고 만료된 기기 토큰을 비활성화합니다."
        meta={`전송 실패 ${stats?.push_failed ?? 0}건`}
        onPress={() => void syncPushReceipts()}
      />

    </AdminColumns>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <MetricCard label="전체 회원" value={stats?.users_total ?? users.length} hint={`최근 30일 ${stats?.users_active_30d ?? 0}명`} />
      <MetricCard label="전체 게시글" value={stats?.posts ?? adminPostTotal} hint={`공지 ${stats?.notices ?? 0}개`} />
      <MetricCard label="전체 댓글" value={stats?.comments ?? 0} hint="삭제 제외 운영 지표" />
      <MetricCard label="미처리 신고" value={stats?.open_reports ?? 0} hint={`푸시 실패 ${stats?.push_failed ?? 0}건`} />
    </View>

    <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600", marginTop: 4 }}>최근 운영 기록</Text>
    {auditLogsQuery.isLoading ? <ActivityIndicator /> : null}
    {!auditLogsQuery.isLoading && auditLogs.length === 0 ? (
      <Panel><Text style={{ color: COLORS.muted }}>아직 기록된 관리자 작업이 없습니다.</Text></Panel>
    ) : null}
    {auditLogs.map((item) => (
      <Panel key={item.id}>
        <View style={{ gap: 5 }}>
          <Text style={{ color: COLORS.text, fontWeight: "600" }}>{item.action}</Text>
          <Text style={{ color: COLORS.muted, fontSize: 13 }}>
            {item.actor_nickname} · {item.target_type}{item.target_id ? ` #${item.target_id}` : ""}
          </Text>
          <Text style={{ color: COLORS.subtle, fontSize: 12 }}>{formatDate(item.created_at)}</Text>
        </View>
      </Panel>
    ))}

    <Text style={{ color: COLORS.primary900, fontSize: 18, fontWeight: "600", marginTop: 4 }}>최근 게시글</Text>
    {adminPostsQuery.isLoading ? <ActivityIndicator /> : null}
    {!adminPostsQuery.isLoading && adminPosts.length === 0 ? (
      <Panel>
        <Text style={{ color: COLORS.muted }}>표시할 게시글이 없습니다.</Text>
      </Panel>
    ) : null}
    {adminPosts.slice(0, 5).map((item) => (
      <AdminPostCard key={item.id} item={item} onPinToggle={handlePinAdminPost} onDelete={handleDeleteAdminPost} />
    ))}
  </View>);
}
