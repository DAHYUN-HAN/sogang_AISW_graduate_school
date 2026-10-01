import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../components/AppTypography";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BoardPostsScreen from "./board/[boardId]";
import LoadingState from "../../components/LoadingState";
import { useBoardsQuery } from "../../hooks/useApi";
import { useTabRootResetStore } from "../../stores/tabRootResetStore";
import type { Board } from "../../types";
import { participationGroupDefaultSlug } from "../../utils/appRoutes";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  cyan50: "#E6F9FB",
  cyan500: "#1FA9BD",
  text: "#111827",
  muted: "#6B7280",
  subtle: "#8A919C",
  border: "#EEF0F3",
  surface: "#FFFFFF",
  bg: "#FFFFFF",
};

type GroupKey = "club" | "study" | "networking";
type ModeKey = "guide" | "certification";

type GroupConfig = {
  key: GroupKey;
  title: string;
  tabLabel: string;
  badge: string;
  description: string;
  gradient: readonly [string, string];
  guideSlugs: string[];
  certificationSlug: string;
};

const GROUPS: GroupConfig[] = [
  {
    key: "club",
    title: "동아리",
    tabLabel: "동아리",
    badge: "안내",
    description: "함께 배우고 오래 이어갈 수 있는 원우 모임을 확인하세요.",
    gradient: ["#2761FF", "#86C8FF"],
    guideSlugs: ["club-promo", "club-apply"],
    certificationSlug: "club-activity",
  },
  {
    key: "study",
    title: "스터디",
    tabLabel: "스터디",
    badge: "안내",
    description: "스터디 모집과 참여 기록을 한 화면에서 이어갑니다.",
    gradient: ["#5B49C8", "#B7A4F8"],
    guideSlugs: ["study-recruit", "study-apply"],
    certificationSlug: "study-activity",
  },
  {
    key: "networking",
    title: "네트워킹",
    tabLabel: "네트워킹",
    badge: "안내",
    description: "선후배 만남, 멘토링, 네트워킹 활동을 확인하세요.",
    gradient: ["#0E7B60", "#55C69A"],
    guideSlugs: ["networking-programs", "alumni-directory", "alumni-photo"],
    certificationSlug: "networking-activity",
  },
];

const MODES: { key: ModeKey; label: string }[] = [
  { key: "guide", label: "안내" },
  { key: "certification", label: "활동 인증" },
];

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
}

function findBoard(boards: Board[], slug: string) {
  return boards.find((board) => board.slug === slug);
}

function openBoard(board?: Board) {
  if (board) {
    router.push(`/board/${board.id}` as never);
  }
}

function openCreate(board?: Board, groupTitle?: string) {
  if (board) {
    router.push({
      pathname: "/board/post/create",
      params: { boardId: String(board.id), category: groupTitle ?? "" },
    } as never);
  }
}

function BoardRow({ board }: { board: Board }) {
  return (
    <Pressable onPress={() => openBoard(board)} style={styles.boardRow}>
      <View style={styles.boardText}>
        <Text style={styles.boardTitle} numberOfLines={1}>
          {board.name}
        </Text>
        <Text style={styles.boardDescription} numberOfLines={2}>
          {board.description}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.subtle} />
    </Pressable>
  );
}

export default function ParticipationScreen() {
  const resetRevision = useTabRootResetStore((state) => state.revisions.participation);

  return <ParticipationContent key={resetRevision} />;
}

function ParticipationContent() {
  const insets = useSafeAreaInsets();
  const [activeGroup, setActiveGroup] = useState<GroupKey>("club");
  const [mode, setMode] = useState<ModeKey>("guide");
  const { data, isLoading, isError, refetch } = useBoardsQuery();
  const boards = useMemo(() => flattenBoards(data?.data), [data?.data]);
  const group = GROUPS.find((item) => item.key === activeGroup) ?? GROUPS[0];
  const guideBoards = group.guideSlugs.map((slug) => findBoard(boards, slug)).filter(Boolean) as Board[];
  const certificationBoard = findBoard(boards, group.certificationSlug);
  const defaultBoard = findBoard(boards, "club-promo");
  const findGroupBoard = (groupKey: GroupKey, nextMode: ModeKey) => {
    const targetGroup = GROUPS.find((item) => item.key === groupKey);
    if (!targetGroup) return undefined;
    if (nextMode === "certification") return findBoard(boards, targetGroup.certificationSlug);
    return targetGroup.guideSlugs.map((slug) => findBoard(boards, slug)).find(Boolean);
  };
  const handleGroupPress = (nextGroup: GroupKey) => {
    const targetBoard = findBoard(boards, participationGroupDefaultSlug(nextGroup));
    if (targetBoard) {
      openBoard(targetBoard);
      return;
    }

    setActiveGroup(nextGroup);
    setMode("guide");
  };
  const handleModePress = (nextMode: ModeKey) => {
    const targetBoard = findGroupBoard(activeGroup, nextMode);
    if (targetBoard) {
      openBoard(targetBoard);
      return;
    }

    setMode(nextMode);
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (defaultBoard) {
    return <BoardPostsScreen initialBoardId={defaultBoard.id} />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.iconButton} />
        <Text style={styles.appBarTitle}>참여활동</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        <View style={styles.primaryTabs}>
          {GROUPS.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => handleGroupPress(item.key)}
              style={[styles.primaryTab, activeGroup === item.key ? styles.primaryTabActive : null]}
            >
              <Text style={[styles.primaryTabText, activeGroup === item.key ? styles.primaryTabTextActive : null]}>{item.tabLabel}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.modeTabs}>
          {MODES.map((item) => (
            <Pressable key={item.key} onPress={() => handleModePress(item.key)} style={[styles.modeTab, mode === item.key ? styles.modeTabActive : null]}>
              <Text style={[styles.modeTabText, mode === item.key ? styles.modeTabTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <LinearGradient colors={group.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{group.badge}</Text>
          </View>
          <Text style={styles.heroTitle}>{group.title}</Text>
          <Text style={styles.heroDescription}>{group.description}</Text>
        </LinearGradient>

        {isError ? (
          <View style={styles.messageBox}>
            <Text style={styles.errorText}>참여활동 정보를 불러오지 못했습니다.</Text>
            <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retryButton}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === "guide" ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{group.title} 안내</Text>
            {guideBoards.length > 0 ? (
              guideBoards.map((board) => <BoardRow key={board.id} board={board} />)
            ) : (
              <View style={styles.messageBox}>
                <Text style={styles.emptyText}>연결된 안내 게시판이 없습니다.</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>활동 인증</Text>
            <View style={styles.certificationPanel}>
              <View style={styles.certificationHeader}>
                <View style={styles.certificationIcon}>
                  <Ionicons name="camera-outline" size={23} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.certificationTitle}>{group.title} 활동 인증</Text>
                  <Text style={styles.certificationMeta}>사진, 소감, 활동일을 함께 남겨주세요.</Text>
                </View>
              </View>
              <View style={styles.noticeStrip}>
                <Ionicons name="information-circle-outline" size={17} color={COLORS.cyan500} />
                <Text style={styles.noticeStripText}>원우회비 납부자 명부에 등록된 사람만 참가자로 검색할 수 있습니다.</Text>
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  disabled={!certificationBoard}
                  onPress={() => openCreate(certificationBoard, group.title)}
                  style={[styles.primaryButton, !certificationBoard ? styles.disabledButton : null]}
                >
                  <Ionicons name="add" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>인증 등록</Text>
                </Pressable>
                <Pressable
                  disabled={!certificationBoard}
                  onPress={() => openBoard(certificationBoard)}
                  style={[styles.secondaryButton, !certificationBoard ? styles.disabledOutline : null]}
                >
                  <Text style={styles.secondaryButtonText}>인증 내역</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  appBar: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.bg,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
  },
  scroller: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  primaryTabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  primaryTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  primaryTabActive: {
    borderBottomColor: COLORS.text,
  },
  primaryTabText: {
    color: COLORS.subtle,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryTabTextActive: {
    color: COLORS.text,
  },
  modeTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
    marginBottom: 16,
  },
  modeTab: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  modeTabActive: {
    borderColor: COLORS.text,
    backgroundColor: COLORS.text,
  },
  modeTabText: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "900",
  },
  modeTabTextActive: {
    color: "#FFFFFF",
  },
  hero: {
    minHeight: 174,
    borderRadius: 8,
    padding: 18,
    justifyContent: "flex-end",
  },
  heroBadge: {
    position: "absolute",
    top: 16,
    left: 16,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.86)",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  heroBadgeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "900",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    lineHeight: 30,
  },
  heroDescription: {
    color: "#EEF4FF",
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 10,
  },
  boardRow: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
  },
  boardText: {
    flex: 1,
    minWidth: 0,
  },
  boardTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
  },
  boardDescription: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 4,
  },
  certificationPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 16,
  },
  certificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  certificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary50,
  },
  certificationTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "900",
  },
  certificationMeta: {
    color: COLORS.muted,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
    marginTop: 3,
  },
  noticeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 8,
    backgroundColor: COLORS.cyan50,
    padding: 10,
    marginTop: 14,
  },
  noticeStripText: {
    flex: 1,
    color: "#14788A",
    fontSize: 12,
    fontWeight: "800",
    lineHeight: 17,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 15,
  },
  primaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    minWidth: 98,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "900",
  },
  disabledButton: {
    backgroundColor: "#D8DDE6",
  },
  disabledOutline: {
    borderColor: "#D8DDE6",
  },
  messageBox: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: 14,
    marginTop: 14,
  },
  emptyText: {
    color: COLORS.muted,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
    fontWeight: "800",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});
