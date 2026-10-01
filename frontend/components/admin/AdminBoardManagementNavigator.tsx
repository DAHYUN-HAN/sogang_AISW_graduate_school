import { Pressable, ScrollView, View } from "react-native";
import { AppText as Text } from "../AppTypography";

import {
  adminBoardsForScope,
  adminScopeForBoard,
  nextAdminBoardSelection,
  type AdminBoardManagementTab,
  type AdminContentScope,
} from "../../utils/adminContentManagement";
import type { Board } from "../../types";

export type AdminBoardManagementNavigatorProps = {
  boards: Board[];
  scope: AdminContentScope;
  selectedBoardId: number | null;
  selectedTab: AdminBoardManagementTab;
  creatingBoard: boolean;
  disabled?: boolean;
  onScopeChange: (scope: AdminContentScope) => void;
  onBoardChange: (boardId: number | null) => void;
  onTabChange: (tab: AdminBoardManagementTab) => void;
  onCreateBoard: () => void;
};

const SCOPE_OPTIONS: { key: AdminContentScope; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "notices", label: "공지사항" },
  { key: "community", label: "커뮤니티·자료" },
  { key: "participation", label: "참여활동" },
  { key: "council", label: "원우회" },
];

const TABS: { key: AdminBoardManagementTab; label: string }[] = [
  { key: "content", label: "콘텐츠" },
  { key: "settings", label: "운영 설정" },
];

export type AdminBoardNavigatorModel = {
  visibleBoards: Board[];
  boardOptions: { id: number | null; label: string }[];
  tabs: { key: AdminBoardManagementTab; label: string }[];
};

export type AdminBoardNavigationTransition = {
  scope: AdminContentScope;
  boardId: number | null;
  tab: AdminBoardManagementTab;
  creatingBoard: boolean;
};

export type AdminBoardContentTargetStatus = "loading" | "error" | "aggregate" | "board" | "missing";
export type AdminBoardContentTarget =
  | { status: "loading" | "error" | "aggregate" }
  | { status: "missing"; reason: "selection" | "empty" }
  | { status: "board"; board: Board };

export type AdminBoardNavigationIntent = {
  slug: string;
  tab: AdminBoardManagementTab;
};

export type AdminBoardNavigationIntentResolution =
  | { status: "pending" }
  | { status: "error" }
  | { status: "missing" }
  | { status: "resolved"; destination: { scope: AdminContentScope; boardId: number; tab: AdminBoardManagementTab } };

export function adminBoardContentTarget(
  boards: Board[],
  scope: AdminContentScope,
  selectedBoardId: number | null,
  queryStatus: "pending" | "error" | "success",
): AdminBoardContentTarget {
  if (queryStatus === "pending") return { status: "loading" };
  if (queryStatus === "error") return { status: "error" };
  if (scope === "all" && selectedBoardId === null) return { status: "aggregate" };
  const scopedBoards = adminBoardsForScope(boards, scope);
  const board = selectedBoardId === null ? undefined : scopedBoards.find((item) => item.id === selectedBoardId);
  if (board) return { status: "board", board };
  return { status: "missing", reason: scopedBoards.length === 0 ? "empty" : "selection" };
}

export function adminBoardNavigationIntentResolution(
  intent: AdminBoardNavigationIntent,
  boards: Board[],
  queryStatus: "pending" | "error" | "success",
): AdminBoardNavigationIntentResolution {
  if (queryStatus === "pending") return { status: "pending" };
  if (queryStatus === "error") return { status: "error" };
  const board = boards.find((item) => item.slug === intent.slug);
  if (!board) return { status: "missing" };
  return {
    status: "resolved",
    destination: {
      scope: adminScopeForBoard(board),
      boardId: board.id,
      tab: intent.tab,
    },
  };
}

export function adminBoardNavigatorModel(
  boards: Board[],
  scope: AdminContentScope,
  selectedBoardId: number | null,
  creatingBoard: boolean,
): AdminBoardNavigatorModel {
  const visibleBoards = adminBoardsForScope(boards, scope);
  const hasSelectedBoard = visibleBoards.some((board) => board.id === selectedBoardId);
  const boardOptions = [
    ...(scope === "all" ? [{ id: null, label: "모든 게시판" }] : []),
    ...visibleBoards.map((board) => ({ id: board.id, label: board.name })),
  ];
  const tabs = creatingBoard
    ? TABS.filter((tab) => tab.key === "settings")
    : hasSelectedBoard
      ? TABS
      : TABS.filter((tab) => tab.key === "content");
  return { visibleBoards, boardOptions, tabs };
}

export function adminBoardScopeTransition(
  boards: Board[],
  currentBoardId: number | null,
  scope: AdminContentScope,
): AdminBoardNavigationTransition {
  return {
    scope,
    boardId: nextAdminBoardSelection(boards, currentBoardId, scope),
    tab: "content",
    creatingBoard: false,
  };
}

export function adminBoardSelectionTransition(boardId: number | null) {
  return { boardId, tab: "content" as const, creatingBoard: false };
}

export function adminBoardCreateTransition() {
  return { tab: "settings" as const, creatingBoard: true };
}

export function adminBoardCreateCancelTransition() {
  return { tab: "content" as const, creatingBoard: false };
}

export function adminBoardCreatedTransition(board: Board): AdminBoardNavigationTransition {
  return {
    scope: adminScopeForBoard(board),
    boardId: board.id,
    tab: "settings",
    creatingBoard: false,
  };
}

export function adminBoardsWithCreatedBoard(boards: Board[], createdBoard: Board): Board[] {
  return [...boards.filter((board) => board.id !== createdBoard.id), createdBoard]
    .sort((left, right) => left.sort_order - right.sort_order || left.id - right.id);
}

export function adminBoardCreationResult(boards: Board[], createdBoard: Board) {
  return {
    boards: adminBoardsWithCreatedBoard(boards, createdBoard),
    transition: adminBoardCreatedTransition(createdBoard),
  };
}

export function isBoardSettingsTargetCurrent(targetBoardId: number, currentBoardId: number | null) {
  return targetBoardId === currentBoardId;
}

export type BoardSettingsSaveResult<Draft> = {
  nextDraft: Draft;
  applyDraft: boolean;
  notification: "success" | "failure" | null;
};

export function boardSettingsSaveResult<Draft>(
  targetBoardId: number,
  currentBoardId: number | null,
  currentDraft: Draft,
  savedDraft: Draft,
  outcome: "success" | "failure",
): BoardSettingsSaveResult<Draft> {
  const targetIsCurrent = isBoardSettingsTargetCurrent(targetBoardId, currentBoardId);
  if (outcome === "success" && targetIsCurrent) {
    return { nextDraft: savedDraft, applyDraft: true, notification: "success" };
  }
  return {
    nextDraft: currentDraft,
    applyDraft: false,
    notification: outcome === "failure" && targetIsCurrent ? "failure" : null,
  };
}

export function shouldClearOptimisticCreatedBoard(
  createdBoardId: number,
  insertedGeneration: number,
  currentGeneration: number,
  queryStatus: "pending" | "error" | "success",
  serverBoards: Board[],
): boolean {
  return queryStatus === "success"
    && currentGeneration > insertedGeneration
    && serverBoards.some((board) => board.id === createdBoardId);
}

function TabButton({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        borderRadius: 6,
        borderWidth: 1,
        borderColor: selected ? "#2761FF" : "#E1E4E9",
        backgroundColor: selected ? "#EDF2FE" : "#ffffff",
        opacity: disabled ? 0.5 : 1,
        paddingHorizontal: 12,
        paddingVertical: 9,
      }}
    >
      <Text style={{ color: selected ? "#2761FF" : "#374151", fontSize: 13, fontWeight: "900" }}>{label}</Text>
    </Pressable>
  );
}

export default function AdminBoardManagementNavigator({
  boards,
  scope,
  selectedBoardId,
  selectedTab,
  creatingBoard,
  disabled = false,
  onScopeChange,
  onBoardChange,
  onTabChange,
  onCreateBoard,
}: AdminBoardManagementNavigatorProps) {
  const { visibleBoards, boardOptions, tabs } = adminBoardNavigatorModel(boards, scope, selectedBoardId, creatingBoard);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 7 }}>
        <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "900" }}>그룹</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {SCOPE_OPTIONS.map((option) => (
            <TabButton
              key={option.key}
              label={option.label}
              selected={scope === option.key}
              disabled={disabled}
              onPress={() => onScopeChange(option.key)}
            />
          ))}
        </ScrollView>
      </View>

      <View style={{ gap: 7 }}>
        <Text style={{ color: "#6B7280", fontSize: 12, fontWeight: "900" }}>게시판</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {boardOptions.map((option) => (
            <TabButton
              key={option.id ?? "all-boards"}
              label={option.label}
              selected={!creatingBoard && selectedBoardId === option.id}
              disabled={disabled}
              onPress={() => onBoardChange(option.id)}
            />
          ))}
          {visibleBoards.length === 0 && scope !== "all" ? (
            <Text style={{ color: "#6B7280", paddingVertical: 9 }}>등록된 게시판이 없습니다.</Text>
          ) : null}
        </ScrollView>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 8 }}>
          {tabs.map((tab) => (
            <TabButton
              key={tab.key}
              label={tab.label}
              selected={selectedTab === tab.key}
              disabled={disabled}
              onPress={() => onTabChange(tab.key)}
            />
          ))}
        </View>
        <Pressable
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={onCreateBoard}
          style={{ borderRadius: 6, borderWidth: 1, borderColor: "#C7CDD4", opacity: disabled ? 0.5 : 1, paddingHorizontal: 12, paddingVertical: 9 }}
        >
          <Text style={{ color: "#374151", fontSize: 12, fontWeight: "900" }}>고급 설정 · 새 게시판 등록</Text>
        </Pressable>
      </View>
    </View>
  );
}
