import { useCallback, useMemo, useRef, useState } from "react";
import {
  hashKey,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  InfiniteData,
  QueryClient,
  QueryKey,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";

import { commentApi, postApi } from "../services/api";
import type { ApiSuccess, Board, PostDetail, PostListItem } from "../types";
import { applyBookmarkResult } from "../utils/postDetailCache";
import {
  firstPostPageData,
  nextPostPage,
  uniquePostItems,
} from "../utils/postFeedPagination";
import type { PostPage } from "../utils/postFeedPagination";

const PAGE_SIZE = 20;
const AGGREGATE_POST_FEED_QUERY_KEY = ["posts", "feed"] as const;
const HOME_NOTICE_QUERY_KEY = ["home", "notices"] as const;

export type PostFilters = {
  q?: string;
  category?: string;
  status?: string;
  sort?: "latest" | "popular" | "views";
};

export type PostFeedScope = "notices" | "resources" | "council_activity";
const ALL_POST_FEED_SCOPES: readonly PostFeedScope[] = ["notices", "resources", "council_activity"];

export type AggregatePostFilters = {
  q?: string;
  notice_category?: "academic" | "event" | "other";
  sort?: "latest" | "popular" | "views";
  pin_priority?: boolean;
};

export type PostMutationCacheTargets = {
  boardIds: readonly number[];
  feedScopes?: readonly PostFeedScope[];
  refreshHomeNotices?: boolean;
};

type PostInfiniteData = InfiniteData<PostPage, number>;
type PostInfiniteQueryOptions = UseInfiniteQueryOptions<
  PostPage,
  Error,
  PostInfiniteData,
  QueryKey,
  number
>;

export type InfinitePostQuery = UseInfiniteQueryResult<PostInfiniteData, Error> & {
  items: PostListItem[];
  refreshFirstPage: () => Promise<void>;
  isRefreshingFirstPage: boolean;
  refreshFirstPageError: Error | null;
  loadNextPage: () => Promise<unknown> | undefined;
};

export function boardPostInfiniteQueryOptions(
  boardId: number,
  filters?: PostFilters,
  enabled = true,
): PostInfiniteQueryOptions {
  return {
    queryKey: ["posts", boardId, filters],
    queryFn: ({ pageParam }) => postApi.getPosts(boardId, pageParam, PAGE_SIZE, filters),
    initialPageParam: 1,
    enabled: enabled && Number.isFinite(boardId) && boardId > 0,
    retry: false,
    getNextPageParam: nextPostPage,
  };
}

export function aggregatePostInfiniteQueryOptions(
  scope: PostFeedScope,
  filters?: AggregatePostFilters,
  enabled = true,
): PostInfiniteQueryOptions {
  return {
    queryKey: ["posts", "feed", scope, filters],
    queryFn: ({ pageParam }) => postApi.getFeed({ scope, page: pageParam, size: PAGE_SIZE, ...filters }),
    initialPageParam: 1,
    enabled,
    retry: false,
    getNextPageParam: nextPostPage,
  };
}

export function refreshPostQueryFirstPage(
  queryClient: QueryClient,
  queryKey: QueryKey,
  load: () => Promise<PostPage>,
  shouldCommit: () => boolean = () => true,
): Promise<void> {
  return (async () => {
    await queryClient.cancelQueries({ queryKey, exact: true });
    const firstPage = await load();
    if (!shouldCommit()) return;
    await queryClient.cancelQueries({ queryKey, exact: true });
    if (shouldCommit()) {
      queryClient.setQueryData(queryKey, firstPostPageData(firstPage));
    }
  })();
}

export async function invalidatePostMutationCaches(
  queryClient: QueryClient,
  { boardIds, feedScopes = [], refreshHomeNotices = false }: PostMutationCacheTargets,
): Promise<void> {
  await Promise.all([
    ...[...new Set(boardIds)].map((boardId) =>
      queryClient.invalidateQueries({ queryKey: ["posts", boardId] })),
    ...[...new Set(feedScopes)].map((scope) =>
      queryClient.invalidateQueries({ queryKey: [...AGGREGATE_POST_FEED_QUERY_KEY, scope] })),
    ...(refreshHomeNotices ? [queryClient.invalidateQueries({ queryKey: HOME_NOTICE_QUERY_KEY })] : []),
  ]);
}

export function postMutationCacheTargets(
  boardId: number,
  board?: Pick<Board, "board_type" | "category" | "slug"> | null,
  options: { refreshHomeNotices?: boolean } = {},
): PostMutationCacheTargets {
  if (board === undefined || board === null) {
    return {
      boardIds: [boardId],
      feedScopes: ALL_POST_FEED_SCOPES,
      refreshHomeNotices: options.refreshHomeNotices ?? true,
    };
  }
  const feedScopes: PostFeedScope[] = [];
  if (board?.board_type === "notice") {
    feedScopes.push("notices", "council_activity");
  } else if (board?.category === "resources") {
    feedScopes.push("resources");
  } else if (board?.slug === "council-activity" || board?.slug === "gsa-activity") {
    feedScopes.push("council_activity");
  }
  return {
    boardIds: [boardId],
    feedScopes,
    refreshHomeNotices: options.refreshHomeNotices ?? board?.board_type === "notice",
  };
}

export function patchCachedPostListItem(
  queryClient: QueryClient,
  postId: number,
  patch: Partial<Pick<PostListItem, "like_count" | "comment_count">>,
): void {
  queryClient.setQueriesData<PostInfiniteData>({ queryKey: ["posts"] }, (current) => {
    if (!current?.pages) return current;
    let changed = false;
    const pages = current.pages.map((page) => {
      let pageChanged = false;
      const data = page.data.map((item) => {
        if (item.id !== postId) return item;
        changed = true;
        pageChanged = true;
        return { ...item, ...patch };
      });
      return pageChanged ? { ...page, data } : page;
    });
    return changed ? { ...current, pages } : current;
  });
}

export function invalidatePopularAggregatePostFeedCaches(
  queryClient: QueryClient,
  scopes?: readonly PostFeedScope[],
): Promise<void> {
  return queryClient.invalidateQueries({
    queryKey: AGGREGATE_POST_FEED_QUERY_KEY,
    predicate: (query) => {
      const scope = query.queryKey[2];
      const filters = query.queryKey[3];
      return (scopes === undefined || scopes.includes(scope as PostFeedScope))
        && typeof filters === "object"
        && filters !== null
        && !Array.isArray(filters)
        && (filters as AggregatePostFilters).sort === "popular";
    },
  });
}

export function invalidatePostLikeCaches(
  queryClient: QueryClient,
  boardId: number,
  board: Pick<Board, "board_type" | "category" | "slug"> | null | undefined,
): Promise<void> {
  const scopes = board === undefined || board === null
    ? undefined
    : postMutationCacheTargets(boardId, board).feedScopes;
  return Promise.all([
    invalidatePopularAggregatePostFeedCaches(queryClient, scopes),
    queryClient.invalidateQueries({ queryKey: ["home", "popular", boardId], exact: true }),
  ]).then(() => undefined);
}

export function createPostFirstPageRefreshCoordinator(
  onRefreshingChange: () => void,
) {
  type FeedRequestState = {
    activeRefreshCount: number;
    latestRefreshRequestId: number;
    loadMoreActive: boolean;
    loadMorePromise?: Promise<unknown>;
    refreshError: Error | null;
  };
  const states = new Map<string, FeedRequestState>();
  let activeQueryHash: string | null = null;

  const stateFor = (queryHash: string) => {
    const state = states.get(queryHash) ?? {
      activeRefreshCount: 0,
      latestRefreshRequestId: 0,
      loadMoreActive: false,
      refreshError: null,
    };
    states.set(queryHash, state);
    return state;
  };

  const removeIdleState = (queryHash: string, state: FeedRequestState) => {
    if (
      state.activeRefreshCount === 0
      && !state.loadMoreActive
      && state.refreshError === null
    ) {
      states.delete(queryHash);
    }
  };

  return {
    activate(queryKey: QueryKey): void {
      const nextQueryHash = hashKey(queryKey);
      if (activeQueryHash === nextQueryHash) return;
      activeQueryHash = nextQueryHash;
      for (const [queryHash, state] of states) {
        state.refreshError = null;
        removeIdleState(queryHash, state);
      }
    },

    isRefreshing(queryKey: QueryKey): boolean {
      return (states.get(hashKey(queryKey))?.activeRefreshCount ?? 0) > 0;
    },

    refreshError(queryKey: QueryKey): Error | null {
      return states.get(hashKey(queryKey))?.refreshError ?? null;
    },

    runLoadMore(
      queryKey: QueryKey,
      task: () => Promise<unknown>,
    ): Promise<unknown> | undefined {
      const queryHash = hashKey(queryKey);
      const state = stateFor(queryHash);
      if (state.activeRefreshCount > 0 || state.loadMoreActive) {
        return undefined;
      }

      state.loadMoreActive = true;
      let taskPromise: Promise<unknown>;
      try {
        taskPromise = Promise.resolve(task());
      } catch (error) {
        taskPromise = Promise.reject(error);
      }
      const trackedPromise = taskPromise
        .catch(() => undefined)
        .finally(() => {
          state.loadMoreActive = false;
          state.loadMorePromise = undefined;
          removeIdleState(queryHash, state);
        });
      state.loadMorePromise = trackedPromise;
      return trackedPromise;
    },

    async run(
      queryKey: QueryKey,
      task: (isLatest: () => boolean) => Promise<void>,
    ): Promise<void> {
      const queryHash = hashKey(queryKey);
      const state = stateFor(queryHash);
      const requestId = ++state.latestRefreshRequestId;
      state.refreshError = null;
      state.activeRefreshCount += 1;
      if (state.activeRefreshCount === 1) {
        onRefreshingChange();
      }

      try {
        await state.loadMorePromise;
        await task(() => requestId === state.latestRefreshRequestId);
      } catch (error) {
        if (requestId === state.latestRefreshRequestId) {
          state.refreshError = error instanceof Error ? error : new Error("Failed to refresh feed.");
        }
      } finally {
        state.activeRefreshCount -= 1;
        if (state.activeRefreshCount === 0) {
          removeIdleState(queryHash, state);
          onRefreshingChange();
        }
      }
    },
  };
}

export function postInfiniteItems(data?: PostInfiniteData): PostListItem[] {
  return uniquePostItems(data?.pages ?? []);
}

function usePostInfiniteQuery(
  options: PostInfiniteQueryOptions,
  loadFirstPage: () => Promise<PostPage>,
): InfinitePostQuery {
  const queryClient = useQueryClient();
  const query = useInfiniteQuery(options);
  const [, setRefreshRevision] = useState(0);
  const refreshCoordinatorRef = useRef<ReturnType<typeof createPostFirstPageRefreshCoordinator> | null>(null);
  if (!refreshCoordinatorRef.current) {
    refreshCoordinatorRef.current = createPostFirstPageRefreshCoordinator(() => {
      setRefreshRevision((current) => current + 1);
    });
  }
  const refreshCoordinator = refreshCoordinatorRef.current;
  refreshCoordinator.activate(options.queryKey);
  const isRefreshingFirstPage = refreshCoordinator.isRefreshing(options.queryKey);
  const refreshFirstPageError = refreshCoordinator.refreshError(options.queryKey);
  const items = useMemo(() => postInfiniteItems(query.data), [query.data]);
  const refreshFirstPage = useCallback(
    () => refreshCoordinator.run(options.queryKey, (isLatest) =>
      refreshPostQueryFirstPage(queryClient, options.queryKey, loadFirstPage, isLatest)),
    [loadFirstPage, options.queryKey, queryClient, refreshCoordinator],
  );
  const loadNextPage = useCallback(
    () => refreshCoordinator.runLoadMore(options.queryKey, () => query.fetchNextPage()),
    [options.queryKey, query, refreshCoordinator],
  );

  return {
    ...query,
    items,
    refreshFirstPage,
    isRefreshingFirstPage,
    refreshFirstPageError,
    loadNextPage,
  };
}

export function useBoardPosts(
  boardId: number,
  filters?: PostFilters,
  enabled = true,
): InfinitePostQuery {
  return usePostInfiniteQuery(
    boardPostInfiniteQueryOptions(boardId, filters, enabled),
    () => postApi.getPosts(boardId, 1, PAGE_SIZE, filters),
  );
}

export function useAggregatePosts(
  scope: PostFeedScope,
  filters?: AggregatePostFilters,
  enabled = true,
): InfinitePostQuery {
  return usePostInfiniteQuery(
    aggregatePostInfiniteQueryOptions(scope, filters, enabled),
    () => postApi.getFeed({ scope, page: 1, size: PAGE_SIZE, ...filters }),
  );
}

export function useMultiBoardPosts(
  boardIds: number[],
  filters?: { q?: string; category?: string; status?: string; sort?: "latest" | "popular" | "views" }
) {
  return useQuery({
    queryKey: ["multi-board-posts", boardIds, filters],
    queryFn: async () => {
      const responses = await Promise.all(
        boardIds.map((boardId) => postApi.getPosts(boardId, 1, PAGE_SIZE, filters))
      );
      return responses.flatMap((response) => response.data);
    },
    enabled: boardIds.length > 0,
    retry: false,
  });
}

export function usePostDetail(postId: number, enabled = true) {
  return useQuery({
    queryKey: ["post", postId],
    queryFn: () => postApi.getPostDetail(postId),
    enabled: enabled && Number.isFinite(postId) && postId > 0,
  });
}

export function usePostComments(postId: number, enabled = true) {
  return useQuery({
    queryKey: ["comments", postId],
    queryFn: () => commentApi.getComments(postId),
    enabled: enabled && Number.isFinite(postId) && postId > 0,
  });
}

type PostMutationPayload = {
  board_id?: number;
  title: string;
  content: string;
  is_anonymous?: boolean;
  category?: string;
  metadata?: Record<string, unknown>;
  attachment_ids?: number[];
};

export function useCreatePost(
  boardId: number,
  board?: Pick<Board, "board_type" | "category" | "slug"> | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PostMutationPayload) => postApi.createPost(boardId, payload),
    onSuccess: async () => {
      await invalidatePostMutationCaches(queryClient, postMutationCacheTargets(boardId, board));
    },
  });
}

export function useUpdatePost(
  postId: number,
  boardId: number,
  board?: Pick<Board, "board_type" | "category" | "slug"> | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: PostMutationPayload) => postApi.updatePost(postId, payload),
    onSuccess: async (_response, payload) => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: ["post", postId] }),
      ];
      const targets = postMutationCacheTargets(boardId, board);
      if (payload.board_id && payload.board_id !== boardId) {
        targets.boardIds = [boardId, payload.board_id];
      }
      invalidations.push(invalidatePostMutationCaches(queryClient, targets));
      await Promise.all(invalidations);
    },
  });
}

export function useUpdateSuggestion(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: string; admin_reply?: string }) => postApi.updateSuggestion(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-suggestions"] });
    },
  });
}

export function useUpdateMutualAid(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { status: "processing" | "completed" | "rejected"; rejection_reason?: string }) =>
      postApi.updateMutualAid(postId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["admin-mutual-aid"] });
    },
  });
}

export function useDeletePost(
  postId: number,
  boardId: number,
  board?: Pick<Board, "board_type" | "category" | "slug"> | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postApi.deletePost(postId),
    onSuccess: async () => {
      await Promise.all([
        invalidatePostMutationCaches(queryClient, postMutationCacheTargets(boardId, board)),
        queryClient.invalidateQueries({ queryKey: ["activity"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "album"] }),
        queryClient.invalidateQueries({ queryKey: ["home", "popular"] }),
      ]);
    },
  });
}

export function useToggleLike(
  postId: number,
  boardId: number,
  board: Pick<Board, "board_type" | "category" | "slug"> | null | undefined,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postApi.toggleLike(postId),
    onSuccess: (response) => {
      queryClient.setQueryData<ApiSuccess<PostDetail>>(["post", postId], (current) =>
        current
          ? {
              ...current,
              data: {
                ...current.data,
                is_liked: response.data.is_liked,
                like_count: response.data.like_count,
              },
            }
          : current
      );
      queryClient.invalidateQueries({ queryKey: ["post", postId] });
      patchCachedPostListItem(queryClient, postId, { like_count: response.data.like_count });
      queryClient.invalidateQueries({ queryKey: ["posts", boardId] });
      void invalidatePostLikeCaches(queryClient, boardId, board);
    },
  });
}

export function useToggleBookmark(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postApi.toggleBookmark(postId),
    onSuccess: (response) => {
      applyBookmarkResult(queryClient, postId, response.data.is_bookmarked);
    },
  });
}

async function invalidateCommentMutationCaches(queryClient: QueryClient, postId: number): Promise<void> {
  // The previous screen stays mounted on Back, so refresh its cached rows too.
  // Refetch keeps loaded pages and uses the server count, including deleted replies.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["comments", postId] }),
    queryClient.invalidateQueries({ queryKey: ["post", postId] }),
    queryClient.invalidateQueries({ queryKey: ["posts"] }),
    queryClient.invalidateQueries({ queryKey: ["multi-board-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["home", "popular"] }),
    queryClient.invalidateQueries({ queryKey: ["activity"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-posts"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-stats"] }),
  ]);
}

export function useCreateComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { content: string; parent_id?: number | null }) =>
      commentApi.createComment(postId, payload),
    onSuccess: () => invalidateCommentMutationCaches(queryClient, postId),
  });
}

export function useUpdateComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      commentApi.updateComment(commentId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", postId] });
    },
  });
}

export function useDeleteComment(postId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: number) => commentApi.deleteComment(commentId),
    onSuccess: () => invalidateCommentMutationCaches(queryClient, postId),
  });
}
