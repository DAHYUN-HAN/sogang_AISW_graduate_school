import { create as createAxiosClient, isAxiosError } from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

import { useUserStore } from "../stores/userStore";
import type {
  AccountDeletionEmailRequest,
  AccountDeletionEmailRequestResult,
  AccountDeletionRequest,
  AccountDeletionResult,
  AccountDeletionVerifyRequest,
  ApiSuccess,
  AdminDuesPaymentItem,
  AdminRosterItem,
  AdminReportItem,
  AdminAuditLog,
  AdminStats,
  AdminUserItem,
  BannerItem,
  BannerPayload,
  Board,
  AuthSession,
  BlockedUserItem,
  BoardGroup,
  CommentNode,
  EventItem,
  EventPayload,
  FAQItem,
  DuesPayerSearchItem,
  DuesPaymentImportResult,
  DuesPaymentWritePayload,
  DuesRosterImportResult,
  NotificationItem,
  NotificationSettings,
  MediaAsset,
  MajorOption,
  LegacyImportRecordItem,
  LegacyImportSummaryItem,
  PostDetail,
  PostListItem,
  SearchResult,
  UserActivityItem,
  UserMe,
  ReportStatus,
  PrivacyPolicyVersion,
  RegistrationOptions,
} from "../types";
import {
  createKeyedSingleFlight,
  resolveApiBaseUrl,
  resolveAuthEmailTimeoutMs,
  resolveMediaUploadTimeoutMs,
  shouldRetryWithCurrentAccessToken,
} from "../utils/apiRuntime";
import { mediaAccessEndpoint } from "../utils/mediaAccess";

function getApiBaseUrl() {
  const expoConstants = Constants as any;
  const hostUri =
    Constants.expoConfig?.hostUri ??
    expoConstants.manifest2?.extra?.expoGo?.debuggerHost ??
    expoConstants.manifest?.debuggerHost;

  return resolveApiBaseUrl({
    configuredUrl: process.env.EXPO_PUBLIC_API_URL,
    platform: Platform.OS,
    expoHostUri: typeof hostUri === "string" ? hostUri : null,
    isDevelopment: __DEV__,
  });
}

export const API_BASE_URL = getApiBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");
export const AUTH_EMAIL_TIMEOUT_MS = resolveAuthEmailTimeoutMs(
  process.env.EXPO_PUBLIC_AUTH_EMAIL_TIMEOUT_MS,
);
export const MEDIA_UPLOAD_TIMEOUT_MS = resolveMediaUploadTimeoutMs(
  process.env.EXPO_PUBLIC_MEDIA_UPLOAD_TIMEOUT_MS,
);

export const api = createAxiosClient({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

const publicApi = createAxiosClient({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

const refreshSession = createKeyedSingleFlight(async (refreshToken: string) => {
  const response = await publicApi.post<
    ApiSuccess<Omit<AuthSession, "user">>
  >("/auth/refresh", {
    refresh_token: refreshToken,
  });
  const currentSession = useUserStore.getState();
  if (
    !currentSession.user ||
    currentSession.refreshToken !== refreshToken
  ) {
    throw new Error("Session changed while the refresh request was in flight.");
  }

  currentSession.setSession({
    access_token: response.data.data.access_token,
    refresh_token: response.data.data.refresh_token,
    user: currentSession.user,
  });
  return response.data.data.access_token;
});

type MutableRequestHeaders = {
  Authorization?: string;
  authorization?: string;
  get?: (name: string) => unknown;
  set?: (name: string, value: string) => void;
};

function requestAuthorization(headers: unknown): unknown {
  if (!headers || typeof headers !== "object") return undefined;
  const candidate = headers as MutableRequestHeaders;
  if (typeof candidate.get === "function") {
    return candidate.get("Authorization");
  }
  return candidate.Authorization ?? candidate.authorization;
}

function setRequestAuthorization(
  request: { headers?: unknown },
  accessToken: string,
) {
  const headers = (request.headers ?? {}) as MutableRequestHeaders;
  if (typeof headers.set === "function") {
    headers.set("Authorization", `Bearer ${accessToken}`);
  } else {
    headers.Authorization = `Bearer ${accessToken}`;
  }
  request.headers = headers;
}

api.interceptors.request.use((config) => {
  const token = useUserStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url ?? "");
    const isRefreshRequest = requestUrl.includes("/auth/refresh");

    if (error.response?.status === 401 && isRefreshRequest) {
      useUserStore.getState().clearSession();
      return Promise.reject(error);
    }

    const session = useUserStore.getState();
    const refreshToken = session.refreshToken;
    if (error.response?.status === 401 && refreshToken && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      if (
        shouldRetryWithCurrentAccessToken(
          requestAuthorization(originalRequest.headers),
          session.accessToken,
        )
      ) {
        setRequestAuthorization(originalRequest, session.accessToken as string);
        return api(originalRequest);
      }

      let accessToken: string;
      try {
        accessToken = await refreshSession(refreshToken);
      } catch {
        const currentSession = useUserStore.getState();
        if (currentSession.refreshToken === refreshToken) {
          currentSession.clearSession();
        }
        return Promise.reject(error);
      }

      setRequestAuthorization(originalRequest, accessToken);
      return api(originalRequest);
    } else if (error.response?.status === 401 && requestUrl && !requestUrl.includes("/auth/")) {
      useUserStore.getState().clearSession();
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: async (payload: { email: string; password: string }) => {
    const response = await api.post<ApiSuccess<AuthSession>>("/auth/login", payload);
    return response.data;
  },
  requestRegisterVerification: async (payload: { email: string }) => {
    const response = await api.post<ApiSuccess<{ email: string; expires_in: number; resend_in?: number; email_sent: boolean }>>(
      "/auth/register/request-verification",
      payload,
      { timeout: AUTH_EMAIL_TIMEOUT_MS },
    );
    return response.data;
  },
  verifyRegisterEmail: async (payload: { email: string; code: string }) => {
    const response = await api.post<ApiSuccess<{ verification_token: string; expires_in: number }>>(
      "/auth/register/verify-email",
      payload
    );
    return response.data;
  },
  register: async (payload: {
    verification_token: string;
    password: string;
    nickname: string;
    cohort: string;
    major: string;
    phone: string;
    privacy_policy_version: string;
    privacy_consent: boolean;
    company?: string;
    job_title?: string;
    position?: string;
  }) => {
    const response = await api.post<ApiSuccess<AuthSession>>("/auth/register", payload);
    return response.data;
  },
  logout: async (refreshToken: string) => {
    const response = await api.post<ApiSuccess<{ logged_out: boolean }>>("/auth/logout", {
      refresh_token: refreshToken,
    });
    return response.data;
  },
  requestPasswordReset: async (payload: { email: string }) => {
    const response = await api.post<ApiSuccess<{ accepted: boolean; expires_in: number; resend_in: number; email_sent?: boolean }>>(
      "/auth/password-reset/request",
      payload,
      { timeout: AUTH_EMAIL_TIMEOUT_MS },
    );
    return response.data;
  },
  verifyPasswordResetCode: async (payload: { email: string; code: string }) => {
    const response = await api.post<ApiSuccess<{ verification_token: string; expires_in: number }>>(
      "/auth/password-reset/verify-code",
      payload
    );
    return response.data;
  },
  confirmPasswordReset: async (payload: { token: string; new_password: string }) => {
    const response = await api.post<ApiSuccess<{ changed: boolean }>>("/auth/password-reset/confirm", payload);
    return response.data;
  },
};

export const registrationApi = {
  getOptions: async () => {
    const response = await api.get<ApiSuccess<RegistrationOptions>>("/registration/options");
    return response.data;
  },
  getAdminMajors: async () => {
    const response = await api.get<ApiSuccess<MajorOption[]>>("/registration/admin/majors");
    return response.data;
  },
  createMajor: async (payload: { name: string; sort_order: number }) => {
    const response = await api.post<ApiSuccess<MajorOption>>("/registration/admin/majors", payload);
    return response.data;
  },
  updateMajor: async (majorId: number, payload: { name: string; sort_order: number; is_active: boolean }) => {
    const response = await api.put<ApiSuccess<MajorOption>>(`/registration/admin/majors/${majorId}`, payload);
    return response.data;
  },
  getAdminPrivacyPolicy: async () => {
    const response = await api.get<ApiSuccess<PrivacyPolicyVersion>>("/registration/admin/privacy-policy");
    return response.data;
  },
  updatePrivacyPolicy: async (payload: { version: string; effective_at: string }) => {
    const response = await api.put<ApiSuccess<PrivacyPolicyVersion>>("/registration/admin/privacy-policy", payload);
    return response.data;
  },
};

export const boardApi = {
  getBoards: async () => {
    const response = await api.get<ApiSuccess<BoardGroup[]>>("/boards");
    return response.data;
  },
  getAdminBoards: async () => {
    const response = await api.get<ApiSuccess<Board[]>>("/boards/admin/all");
    return response.data;
  },
  createAdminBoard: async (payload: {
    name: string;
    slug: string;
    category: string;
    board_type: string;
    description?: string;
    sort_order?: number;
    allow_anonymous?: boolean;
    read_permission?: string;
    write_permission?: string;
    metadata?: Record<string, unknown>;
    is_active?: boolean;
  }) => {
    const response = await api.post<ApiSuccess<Board>>("/boards/admin", payload);
    return response.data;
  },
  updateAdminBoard: async (
    boardId: number,
    payload: Partial<{
      name: string;
      category: string;
      board_type: string;
      description?: string | null;
      sort_order: number;
      allow_anonymous: boolean;
      read_permission: string;
      write_permission: string;
      metadata?: Record<string, unknown>;
      is_active: boolean;
    }>
  ) => {
    const response = await api.put<ApiSuccess<Board>>(`/boards/admin/${boardId}`, payload);
    return response.data;
  },
};

export const bannerApi = {
  getBanners: async (params?: { placement?: "home"; include_inactive?: boolean }) => {
    const response = await api.get<ApiSuccess<BannerItem[]>>("/banners", { params });
    return response.data;
  },
  createBanner: async (payload: BannerPayload) => {
    const response = await api.post<ApiSuccess<BannerItem>>("/banners", payload);
    return response.data;
  },
  updateBanner: async (bannerId: number, payload: Partial<BannerPayload>) => {
    const response = await api.put<ApiSuccess<BannerItem>>(`/banners/${bannerId}`, payload);
    return response.data;
  },
  deleteBanner: async (bannerId: number) => {
    const response = await api.delete<ApiSuccess<{ id: number; is_active: boolean }>>(`/banners/${bannerId}`);
    return response.data;
  },
};

export const postApi = {
  getAdminPosts: async (params?: {
    page?: number;
    size?: number;
    q?: string;
    board_id?: number;
    board_category?: string;
    board_type?: string;
    status?: "draft" | "published" | "hidden" | "deleted";
    is_pinned?: boolean;
    is_notice?: boolean;
  }) => {
    const response = await api.get<ApiSuccess<PostListItem[]>>("/posts/admin/all", { params });
    return response.data;
  },
  getPosts: async (
    boardId: number,
    page: number,
    size: number,
    filters?: { q?: string; category?: string; status?: string; sort?: "latest" | "popular" | "views" }
  ) => {
    const response = await api.get<ApiSuccess<PostListItem[]>>(`/boards/${boardId}/posts`, {
      params: { page, size, ...filters },
    });
    return response.data;
  },
  getFeed: async (params: {
    scope: "notices" | "resources" | "council_activity";
    page: number;
    size: number;
    q?: string;
    notice_category?: "academic" | "event" | "other";
    sort?: "latest" | "popular" | "views";
    pin_priority?: boolean;
  }) => {
    const response = await api.get<ApiSuccess<PostListItem[]>>("/posts/feed", { params });
    return response.data;
  },
  getPostDetail: async (postId: number, forEdit = false) => {
    const response = await api.get<ApiSuccess<PostDetail>>(`/posts/${postId}`, { params: forEdit ? { for_edit: true } : undefined });
    return response.data;
  },
  createPost: async (
    boardId: number,
    payload: {
      title: string;
      content: string;
      is_anonymous?: boolean;
      category?: string;
      metadata?: Record<string, unknown>;
      attachment_ids?: number[];
      deadline_at?: string | null;
    }
  ) => {
    const response = await api.post<ApiSuccess<{ id: number }>>(`/boards/${boardId}/posts`, payload);
    return response.data;
  },
  updatePost: async (
    postId: number,
    payload: {
      replace_evidence?: boolean;
      board_id?: number;
      title: string;
      content: string;
      is_anonymous?: boolean;
      category?: string;
      metadata?: Record<string, unknown>;
      attachment_ids?: number[];
      deadline_at?: string | null;
    }
  ) => {
    const response = await api.put<ApiSuccess<{ id: number }>>(`/posts/${postId}`, payload);
    return response.data;
  },
  replaceRepresentativeImage: async (postId: number, mediaId: number) => {
    const response = await api.put<ApiSuccess<{ post_id: number; media_id: number }>>(
      `/posts/${postId}/representative-image`,
      { media_id: mediaId },
    );
    return response.data;
  },
  updateSuggestion: async (postId: number, payload: { status: string; admin_reply?: string }) => {
    const response = await api.put<ApiSuccess<{ post_id: number; status: string; suggestion: PostDetail["suggestion"] }>>(
      `/posts/${postId}/suggestion`,
      payload
    );
    return response.data;
  },
  updateMutualAid: async (
    postId: number,
    payload: { status: "processing" | "completed" | "rejected"; rejection_reason?: string }
  ) => {
    const response = await api.put<ApiSuccess<{ post_id: number; mutual_aid: PostDetail["mutual_aid"] }>>(
      `/posts/${postId}/mutual-aid`,
      payload
    );
    return response.data;
  },
  deletePost: async (postId: number) => {
    const response = await api.delete<ApiSuccess<{ id: number }>>(`/posts/${postId}`);
    return response.data;
  },
  toggleLike: async (postId: number) => {
    const response = await api.post<ApiSuccess<{ post_id: number; is_liked: boolean; like_count: number }>>(
      `/posts/${postId}/like`
    );
    return response.data;
  },
  toggleBookmark: async (postId: number) => {
    const response = await api.post<ApiSuccess<{ post_id: number; is_bookmarked: boolean }>>(
      `/posts/${postId}/bookmark`
    );
    return response.data;
  },
  setPin: async (postId: number, isPinned: boolean) => {
    const response = await api.put<ApiSuccess<{ post_id: number; is_pinned: boolean }>>(`/posts/${postId}/pin`, {
      is_pinned: isPinned,
    });
    return response.data;
  },
};

export const searchApi = {
  search: async (params: { q: string; scope?: string; board_id?: number; notice_category?: string; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<SearchResult[]>>("/search", { params });
    return response.data;
  },
  recent: async () => {
    const response = await api.get<ApiSuccess<{ keyword: string; searched_at: string }[]>>("/search/recent");
    return response.data;
  },
};

export const commentApi = {
  getComments: async (postId: number) => {
    const response = await api.get<ApiSuccess<CommentNode[]>>(`/posts/${postId}/comments`);
    return response.data;
  },
  createComment: async (postId: number, payload: { content: string; parent_id?: number | null }) => {
    const response = await api.post<ApiSuccess<{ id: number }>>(`/posts/${postId}/comments`, payload);
    return response.data;
  },
  updateComment: async (commentId: number, payload: { content: string }) => {
    const response = await api.put<ApiSuccess<{ id: number }>>(`/comments/${commentId}`, payload);
    return response.data;
  },
  deleteComment: async (commentId: number) => {
    const response = await api.delete<ApiSuccess<{ id: number }>>(`/comments/${commentId}`);
    return response.data;
  },
};

export const userApi = {
  checkNickname: async (nickname: string) => {
    const response = await api.get<ApiSuccess<{ nickname: string; available: boolean }>>("/users/nickname-availability", {
      params: { nickname },
    });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get<ApiSuccess<UserMe>>("/users/me");
    return response.data;
  },
  updateMe: async (
    payload: Partial<
      Pick<UserMe, "major" | "phone" | "company" | "job_title" | "position" | "profile_image_url">
    >
  ) => {
    const response = await api.put<ApiSuccess<{ id: number }>>("/users/me", payload);
    return response.data;
  },
  verifyPassword: async (payload: { current_password: string }) => {
    const response = await api.post<ApiSuccess<{ valid: boolean }>>("/users/me/password/verify", payload);
    return response.data;
  },
  updatePassword: async (payload: { current_password: string; new_password: string }) => {
    const response = await api.put<ApiSuccess<{ changed: boolean }>>("/users/me/password", payload);
    return response.data;
  },
  deleteMe: async (payload: AccountDeletionRequest) => {
    const response = await api.delete<ApiSuccess<AccountDeletionResult>>("/users/me", { data: payload });
    return response.data;
  },
  requestAccountDeletion: async (payload: AccountDeletionEmailRequest) => {
    const response = await publicApi.post<ApiSuccess<AccountDeletionEmailRequestResult>>(
      "/auth/account-deletion/request",
      payload,
      { timeout: AUTH_EMAIL_TIMEOUT_MS },
    );
    return response.data;
  },
  verifyAccountDeletion: async (payload: AccountDeletionVerifyRequest) => {
    const response = await publicApi.post<ApiSuccess<AccountDeletionResult>>(
      "/auth/account-deletion/verify",
      payload
    );
    return response.data;
  },
  getActivity: async (params?: { type?: "posts" | "comments" | "bookmarks"; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<UserActivityItem[]>>("/users/me/activity", { params });
    return response.data;
  },
  getBlockedUsers: async () => {
    const response = await api.get<ApiSuccess<BlockedUserItem[]>>("/users/me/blocks");
    return response.data;
  },
  blockUser: async (payload: { blocked_user_id: number; reason?: string }) => {
    const response = await api.post<ApiSuccess<{ id: number; blocked_user_id: number; duplicate: boolean }>>(
      "/users/me/blocks",
      payload
    );
    return response.data;
  },
  unblockUser: async (blockedUserId: number) => {
    const response = await api.delete<ApiSuccess<{ blocked_user_id: number; blocked: boolean }>>(
      `/users/me/blocks/${blockedUserId}`
    );
    return response.data;
  },
};

export const eventApi = {
  getEvents: async (params?: { from_date?: string; to_date?: string; category?: string }) => {
    const response = await api.get<ApiSuccess<EventItem[]>>("/events", { params });
    return response.data;
  },
  getEvent: async (eventId: number) => {
    const response = await api.get<ApiSuccess<EventItem>>(`/events/${eventId}`);
    return response.data;
  },
  createEvent: async (payload: EventPayload) => {
    const response = await api.post<ApiSuccess<EventItem>>("/events", payload);
    return response.data;
  },
  updateEvent: async (eventId: number, payload: EventPayload) => {
    const response = await api.put<ApiSuccess<EventItem>>(`/events/${eventId}`, payload);
    return response.data;
  },
  deleteEvent: async (eventId: number) => {
    const response = await api.delete<ApiSuccess<{ id: number }>>(`/events/${eventId}`);
    return response.data;
  },
};

export const faqApi = {
  getFAQs: async (params?: { category?: string; include_inactive?: boolean }) => {
    const response = await api.get<ApiSuccess<FAQItem[]>>("/faqs", { params });
    return response.data;
  },
  createFAQ: async (payload: {
    question: string;
    answer: string;
    category?: string;
    sort_order?: number;
    is_active?: boolean;
  }) => {
    const response = await api.post<ApiSuccess<FAQItem>>("/faqs", payload);
    return response.data;
  },
  updateFAQ: async (
    faqId: number,
    payload: {
      question: string;
      answer: string;
      category?: string;
      sort_order?: number;
      is_active?: boolean;
    }
  ) => {
    const response = await api.put<ApiSuccess<FAQItem>>(`/faqs/${faqId}`, payload);
    return response.data;
  },
  deleteFAQ: async (faqId: number) => {
    const response = await api.delete<ApiSuccess<{ id: number }>>(`/faqs/${faqId}`);
    return response.data;
  },
};

export const notificationApi = {
  getNotifications: async (page = 1, size = 30) => {
    const response = await api.get<ApiSuccess<NotificationItem[]>>("/notifications", { params: { page, size } });
    return response.data;
  },
  markRead: async (notificationId: number) => {
    const response = await api.put<ApiSuccess<{ id: number; is_read: boolean }>>(
      `/notifications/${notificationId}/read`
    );
    return response.data;
  },
  getSettings: async () => {
    const response = await api.get<ApiSuccess<NotificationSettings>>("/notifications/settings/me");
    return response.data;
  },
  updateSettings: async (payload: NotificationSettings) => {
    const response = await api.put<ApiSuccess<NotificationSettings>>("/notifications/settings/me", payload);
    return response.data;
  },
  registerPushToken: async (payload: { token: string; platform: string }) => {
    const response = await api.post<ApiSuccess<{ id: number; registered: boolean }>>("/notifications/push-token", payload);
    return response.data;
  },
  deactivatePushToken: async (payload: { token: string; platform: string }) => {
    const response = await api.delete<ApiSuccess<{ registered: boolean }>>("/notifications/push-token", { data: payload });
    return response.data;
  },
};

export const mediaApi = {
  upload: async (
    file: { uri: string; name: string; type: string } | File,
    onProgress?: (progress: number) => void,
    isPrivate = false
  ) => {
    const formData = new FormData();
    formData.append("file", file as any);
    formData.append("private", String(isPrivate));
    const response = await api.post<ApiSuccess<MediaAsset>>("/media/uploads", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: MEDIA_UPLOAD_TIMEOUT_MS,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      },
    });
    return response.data;
  },
  getPrivateDownloadLink: async (mediaId: number) => {
    const response = await api.get<ApiSuccess<{ url: string; expires_in: number }>>(`/media/${mediaId}/download-link`);
    return response.data;
  },
  getAccessUrl: async (mediaId: number) => {
    try {
      const response = await api.get<ApiSuccess<{ url: string; expires_in: number }>>(mediaAccessEndpoint(mediaId));
      return response.data;
    } catch (error) {
      if (!isAxiosError(error) || error.response?.status !== 404) throw error;
      const legacyResponse = await api.get<ApiSuccess<{ url: string; expires_in: number }>>(`/media/${mediaId}/download-link`);
      return legacyResponse.data;
    }
  },
  getAccessUrlForPath: async (path: string) => {
    const response = await api.get<ApiSuccess<{ url: string; expires_in: number }>>("/media/access-url", {
      params: { path },
    });
    return response.data;
  },
};

export const reportApi = {
  reportPost: async (postId: number, payload: { reason: string; detail?: string }) => {
    const response = await api.post<ApiSuccess<{ id: number; status: string; duplicate: boolean }>>(
      `/posts/${postId}/report`,
      payload
    );
    return response.data;
  },
  reportComment: async (commentId: number, payload: { reason: string; detail?: string }) => {
    const response = await api.post<ApiSuccess<{ id: number; status: string; duplicate: boolean }>>(
      `/comments/${commentId}/report`,
      payload
    );
    return response.data;
  },
  getAdminReports: async (params?: { status?: ReportStatus | "all"; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<AdminReportItem[]>>("/admin/reports", { params });
    return response.data;
  },
  updateAdminReport: async (reportId: number, payload: { status: ReportStatus }) => {
    const response = await api.put<ApiSuccess<AdminReportItem>>(`/admin/reports/${reportId}`, payload);
    return response.data;
  },
};

export const adminApi = {
  getStats: async () => {
    const response = await api.get<ApiSuccess<AdminStats>>("/admin/stats");
    return response.data;
  },
  getAuditLogs: async (params?: { page?: number; size?: number; action?: string }) => {
    const response = await api.get<ApiSuccess<AdminAuditLog[]>>("/admin/audit-logs", { params });
    return response.data;
  },
  getLegacyImportSummary: async () => {
    const response = await api.get<ApiSuccess<LegacyImportSummaryItem[]>>("/admin/legacy-import/summary");
    return response.data;
  },
  getLegacyImportRecords: async (params?: {
    page?: number;
    size?: number;
    status?: string;
    entity_type?: string;
    source_id?: string;
  }) => {
    const response = await api.get<ApiSuccess<LegacyImportRecordItem[]>>("/admin/legacy-import/records", { params });
    return response.data;
  },
  dispatchEventReminders: async (targetDate?: string) => {
    const response = await api.post<ApiSuccess<{ target_date: string; created: number }>>(
      "/events/admin/dispatch-reminders",
      undefined,
      { params: targetDate ? { target_date: targetDate } : undefined }
    );
    return response.data;
  },
  syncPushReceipts: async () => {
    const response = await api.post<ApiSuccess<{ checked: number; delivered: number; failed: number }>>(
      "/notifications/admin/push-receipts/sync"
    );
    return response.data;
  },
  getUsers: async (params?: { q?: string; role?: "user" | "admin"; is_active?: boolean; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<AdminUserItem[]>>("/users/admin/users", { params });
    return response.data;
  },
  updateUser: async (
    userId: number,
    payload: {
      role?: "user" | "admin";
      is_active?: boolean;
      enrollment_status?: "active" | "leave" | "graduated";
    }
  ) => {
    const response = await api.put<ApiSuccess<{ id: number; role: "user" | "admin"; is_active: boolean }>>(
      `/users/admin/users/${userId}`,
      payload
    );
    return response.data;
  },
};

export const duesPayerApi = {
  search: async (q: string, boardId: number, size = 8) => {
    const response = await api.get<ApiSuccess<DuesPayerSearchItem[]>>("/dues-payers/search", {
      params: { q, board_id: boardId, size },
    });
    return response.data;
  },
  getAdminRoster: async (params?: { q?: string; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<AdminRosterItem[]>>("/dues-payers/admin/roster", { params });
    return response.data;
  },
  getAdminPayments: async (params?: { q?: string; page?: number; size?: number }) => {
    const response = await api.get<ApiSuccess<AdminDuesPaymentItem[]>>("/dues-payers/admin/payments", { params });
    return response.data;
  },
  importRosterWorkbook: (file: File | { uri: string; name: string; type: string }) =>
    postDuesWorkbook<DuesRosterImportResult>("/dues-payers/admin/roster/import", file),
  importPaymentWorkbook: (file: File | { uri: string; name: string; type: string }) =>
    postDuesWorkbook<DuesPaymentImportResult>("/dues-payers/admin/payments/import", file),
  updatePayment: async (rosterMemberId: number, payload: DuesPaymentWritePayload) => {
    const response = await api.put<ApiSuccess<AdminDuesPaymentItem>>(
      `/dues-payers/admin/payments/${rosterMemberId}`,
      payload,
    );
    return response.data;
  },
};

async function postDuesWorkbook<Result>(
  path: string,
  file: File | { uri: string; name: string; type: string },
) {
  const formData = new FormData();
  formData.append("file", file as any);
  const response = await api.post<ApiSuccess<Result>>(
    path,
    formData,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: MEDIA_UPLOAD_TIMEOUT_MS,
    },
  );
  return response.data;
}
