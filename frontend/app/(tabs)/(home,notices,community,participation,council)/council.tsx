import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText as Text } from "../../../components/AppTypography";
import { NetworkErrorFallback } from "../../../components/NetworkErrorState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import LoadingState from "../../../components/LoadingState";
import { useBoardsQuery } from "../../../hooks/useApi";
import type { Board } from "../../../types";

const COLORS = {
  primary: "#2761FF",
  primary50: "#EDF2FE",
  text: "#15171C",
  muted: "#6B7280",
  subtle: "#8A919C",
  border: "#EEF0F3",
  bg: "#FFFFFF",
};

type MenuItem = {
  title: string;
  slugs?: string[];
  href?: string;
};

const MENU_ITEMS: MenuItem[] = [
  {
    title: "원우회 임원진 소개",
    slugs: ["gsa-executives"],
  },
  {
    title: "회계장부",
    slugs: ["accounting"],
  },
  {
    title: "원우회 상조회",
    slugs: ["mutual-aid", "gsa-mutual-aid"],
  },
  {
    title: "기수별 기장단 소개",
    slugs: ["gsa-cohort-leaders"],
  },
  {
    title: "역대 원우회",
    slugs: ["gsa-past-councils"],
  },
  {
    title: "건의사항",
    slugs: ["suggestions", "gsa-proposal", "gsa-feedback"],
  },
  {
    title: "자주 묻는 질문",
    href: "/faq",
  },
];

function flattenBoards(groups?: { boards: Board[] }[]) {
  return groups?.flatMap((group) => group.boards) ?? [];
}

function boardBySlugs(boards: Board[], slugs?: string[]) {
  return slugs ? boards.find((board) => slugs.includes(board.slug)) : undefined;
}

function openItem(item: MenuItem, board?: Board) {
  if (item.href) {
    router.push(item.href as never);
    return;
  }
  if (board) {
    router.push(`/board/${board.id}` as never);
  }
}

function MenuRow({ item, board }: { item: MenuItem; board?: Board }) {
  return (
    <Pressable onPress={() => openItem(item, board)} style={styles.menuRow}>
      <Text style={styles.menuTitle}>{item.title}</Text>
      <Ionicons name="chevron-forward" size={15} color={COLORS.subtle} />
    </Pressable>
  );
}

export default function CouncilScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading, isError, error, refetch } = useBoardsQuery();
  const boards = useMemo(() => flattenBoards(data?.data), [data?.data]);

  if (isLoading) {
    return <LoadingState />;
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.appBar, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={styles.iconButton} />
        <Text style={styles.appBarTitle}>원우회</Text>
        <View style={styles.iconButton} />
      </View>

      <ScrollView style={styles.scroller} contentContainerStyle={styles.content}>
        {isError ? (
          <NetworkErrorFallback error={error} onRetry={() => void refetch()}>
            <View style={styles.messageBox}>
              <Text style={styles.errorText}>원우회 정보를 불러오지 못했습니다.</Text>
              <Pressable accessibilityRole="button" onPress={() => void refetch()} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>다시 시도</Text>
              </Pressable>
            </View>
          </NetworkErrorFallback>
        ) : null}

        <View style={styles.menuList}>
          {MENU_ITEMS.map((item) => (
            <MenuRow key={item.title} item={item} board={boardBySlugs(boards, item.slugs)} />
          ))}
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
  },
  appBarTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "500",
  },
  scroller: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
  menuList: {
    paddingTop: 12,
  },
  menuRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E1E4E9",
    paddingVertical: 13,
  },
  menuTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "400",
  },
  messageBox: {
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF1F2",
    padding: 14,
    marginBottom: 14,
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
