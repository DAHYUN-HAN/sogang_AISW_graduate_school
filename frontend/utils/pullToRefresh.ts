import type { NoticeFilter } from "./noticeFeed";

type Refetch = () => Promise<unknown>;

export function enabledRefetch(enabled: boolean, refetch: Refetch): Refetch | undefined {
  return enabled ? refetch : undefined;
}

export function noticeRefreshControlRefreshing({
  boardsLoading,
  postsLoading = false,
  pullRefreshing,
}: {
  boardsLoading: boolean;
  postsLoading?: boolean;
  /** 사용자가 목록을 당겨서 시작한 새로고침이 진행 중인지. 백그라운드 refetch는 포함하지 않는다. */
  pullRefreshing: boolean;
}): boolean {
  return !boardsLoading && !postsLoading && pullRefreshing;
}

export async function refreshQueries(
  refreshers: readonly (Refetch | null | undefined)[],
): Promise<void> {
  const enabled = refreshers.filter((refetch): refetch is Refetch => Boolean(refetch));
  await Promise.allSettled(enabled.map((refetch) => refetch()));
}

export async function selectNoticeFilterAndRefresh(
  filter: NoticeFilter,
  activeFilter: NoticeFilter,
  selectFilter: (filter: NoticeFilter) => void,
  refetchBoards: Refetch,
  refreshCurrentFeed: Refetch,
): Promise<void> {
  selectFilter(filter);
  await refreshQueries([
    refetchBoards,
    filter === activeFilter ? refreshCurrentFeed : undefined,
  ]);
}
