export type ApiSuccess<T> = {
  status: "success";
  data: T;
  pagination?: {
    page: number;
    size: number;
    total: number;
    total_pages: number;
  };
};

export type AuthUser = {
  id: number;
  email: string;
  nickname: string;
  cohort?: string;
  role: string;
};

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
};

export type AccountDeletionRequest = {
  current_password: string;
};

export type AccountDeletionResult = {
  deleted: boolean;
  receipt_id: string;
  completed_at: string;
};

export type AccountDeletionEmailRequest = {
  email: string;
};

export type AccountDeletionEmailRequestResult = {
  accepted: boolean;
  expires_in: number;
  resend_in: number;
};

export type AccountDeletionVerifyRequest = {
  email: string;
  code: string;
  current_password: string;
};

export type MajorOption = {
  id: number;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type PrivacyPolicyVersion = {
  id: number;
  version: string;
  effective_at: string;
  is_active: boolean;
  updated_at: string;
};

export type RegistrationOptions = {
  majors: MajorOption[];
  privacy_policy: PrivacyPolicyVersion;
};

export type Board = {
  id: number;
  name: string;
  slug: string;
  category: string;
  board_type: string;
  description?: string | null;
  sort_order: number;
  allow_anonymous: boolean;
  read_permission: string;
  write_permission: string;
  metadata?: Record<string, unknown> | null;
  is_active?: boolean;
  created_at?: string;
};

export type BoardGroup = {
  category: string;
  boards: Board[];
};

export type BannerItem = {
  id: number;
  placement: "home";
  title?: string | null;
  subtitle?: string | null;
  badge_text?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  image_url?: string | null;
  image_urls?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  } | null;
  theme: "none" | "blue" | "navy" | "cyan" | "purple";
  sort_order: number;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  deadline_at?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
};

export type BannerPayload = {
  placement?: "home";
  title?: string | null;
  subtitle?: string | null;
  badge_text?: string | null;
  cta_label?: string | null;
  cta_href?: string | null;
  image_url?: string | null;
  image_urls?: {
    mobile?: string;
    tablet?: string;
    desktop?: string;
  } | null;
  theme: "none" | "blue" | "navy" | "cyan" | "purple";
  sort_order?: number;
  is_active?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  deadline_at?: string | null;
};

export type PostListItem = {
  id: number;
  board_id: number;
  board_name?: string;
  board_category?: string;
  board_type?: string;
  title: string;
  content_preview: string;
  author_id: number | null;
  author_nickname: string;
  author_cohort?: string | null;
  is_anonymous: boolean;
  is_pinned: boolean;
  is_notice: boolean;
  status: string;
  category?: string;
  activity_source_title?: string | null;
  metadata?: Record<string, unknown>;
  suggestion?: SuggestionDetail | null;
  mutual_aid?: MutualAidDetail | null;
  attachment_count?: number;
  thumbnail_media_id?: number | null;
  thumbnail_url?: string | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at?: string;
  deadline_at?: string | null;
  highlights?: {
    title: string;
    content_preview: string;
  } | null;
};

export type PostDetail = {
  id: number;
  board_id: number;
  title: string;
  content: string;
  author_id: number | null;
  author_nickname: string;
  author_cohort?: string | null;
  is_anonymous: boolean;
  is_pinned: boolean;
  is_notice: boolean;
  status: string;
  category?: string;
  activity_source_title?: string | null;
  metadata?: Record<string, unknown>;
  suggestion?: SuggestionDetail | null;
  mutual_aid?: MutualAidDetail | null;
  attachments: MediaAsset[];
  view_count: number;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
  created_at: string;
  updated_at: string;
  deadline_at?: string | null;
};

export type MutualAidStatus = "processing" | "completed" | "rejected";

export type SuggestionDetail = {
  category?: string;
  status: "received" | "answered";
  admin_reply?: string | null;
  replied_by?: number | null;
  replied_at?: string | null;
};

export type MutualAidDetail = {
  event_type: string;
  event_date: string;
  relation: string;
  status: MutualAidStatus;
  rejection_reason?: string | null;
  reviewed_by?: number | null;
  reviewed_at?: string | null;
  has_evidence?: boolean;
};

export type MediaAsset = {
  id: number;
  original_filename: string;
  stored_filename?: string;
  content_type: string;
  file_size: number;
  url?: string;
  is_private?: boolean;
  status?: string;
  created_at?: string;
};

export type SearchResult = {
  type: "post";
  id: number;
  board_id: number;
  board_name: string;
  board_slug?: string;
  category?: string | null;
  title: string;
  content_preview: string;
  author_nickname: string;
  author_cohort?: string | null;
  created_at: string;
  highlights: {
    title: string;
    content_preview: string;
  };
};

export type EventItem = {
  id: number;
  title: string;
  description?: string;
  location?: string;
  category: string;
  color?: string;
  start_at: string;
  end_at?: string | null;
  created_by?: number;
  created_at: string;
  updated_at: string;
};

export type EventPayload = {
  title: string;
  description?: string;
  location?: string;
  category: string;
  color?: string;
  start_at: string;
  end_at?: string;
};

export type UserActivityItem = {
  type: "post" | "comment" | "bookmark";
  id: number;
  post_id: number;
  title: string;
  content_preview?: string;
  board_id: number;
  board_name?: string;
  category?: string | null;
  comment_count?: number;
  like_count?: number;
  author_nickname?: string | null;
  author_cohort?: string | null;
  created_at: string;
};

export type FAQItem = {
  id: number;
  question: string;
  answer: string;
  category?: string;
  sort_order: number;
  is_active: boolean;
  attachments: MediaAsset[];
  created_at: string;
  updated_at: string;
};

export type NotificationItem = {
  id: number;
  notification_type: string;
  message: string;
  post_id?: number;
  event_id?: number;
  is_read: boolean;
  created_at: string;
};

export type NotificationSettings = {
  notify_comment: boolean;
  notify_like: boolean;
  notify_notice: boolean;
  notify_event: boolean;
  notify_council: boolean;
};

export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type BlockedUserItem = {
  id: number;
  blocked_user_id: number;
  blocked_user_nickname: string;
  reason?: string | null;
  created_at: string;
};

export type AdminUserItem = {
  id: number;
  email: string;
  nickname: string;
  cohort?: string | null;
  major?: string | null;
  phone?: string | null;
  company?: string | null;
  job_title?: string | null;
  position?: string | null;
  role: "user" | "admin";
  is_active: boolean;
  enrollment_status: "active" | "leave" | "graduated";
  last_login_at?: string | null;
  created_at: string;
  privacy_policy_version?: string | null;
  privacy_consented_at?: string | null;
};

export type DuesPaymentScope = "ALL" | "ONCE" | "UNPAID";

export type DuesPayerSearchItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
  is_paid_for_board: boolean;
};

export type AdminDuesPayerItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
  payment_scope: DuesPaymentScope;
  is_full_paid: boolean;
  once_board_id: number | null;
  once_board_name: string | null;
};

export type DuesPayerWritePayload = {
  name: string;
  major: string;
  student_number: string;
  payment_scope: DuesPaymentScope;
  once_board_id: number | null;
};

export type DuesRosterImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  total_rows: number;
};

export type DuesPaymentImportResult = {
  activated: number;
  reset: number;
  unchanged: number;
  total_rows: number;
};

export type DuesPaymentResetResult = {
  reset: number;
};

export type AdminReportItem = {
  id: number;
  target_type: "post" | "comment";
  target_id: number;
  reason: string;
  detail?: string | null;
  status: ReportStatus;
  reporter_id: number;
  reporter_nickname: string;
  created_at: string;
  updated_at: string;
  target: {
    target_exists: boolean;
    target_deleted: boolean;
    post_id?: number;
    board_id?: number;
    title?: string;
    content_preview?: string;
    author_id?: number;
    author_nickname?: string;
  };
};

export type AdminStats = {
  users_total: number;
  users_active: number;
  users_active_30d: number;
  admins: number;
  posts: number;
  notices: number;
  comments: number;
  events: number;
  open_reports: number;
  active_push_tokens: number;
  push_failed: number;
};

export type AdminAuditLog = {
  id: number;
  actor_id?: number | null;
  actor_nickname: string;
  action: string;
  target_type: string;
  target_id?: number | null;
  details?: Record<string, unknown> | null;
  created_at: string;
};

export type LegacyImportSummaryItem = {
  entity_type: string;
  status: string;
  action: string;
  count: number;
};

export type LegacyImportRecordItem = {
  id: number;
  source_file: string;
  source_sheet: string;
  source_row: number;
  entity_type: string;
  source_id: string;
  source_parent_id?: string | null;
  source_hash: string;
  action: string;
  status: string;
  target_table?: string | null;
  target_id?: number | null;
  reason?: string | null;
  redacted_details?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type CommentNode = {
  id: number;
  post_id: number;
  author_id: number | null;
  author_nickname: string;
  author_cohort?: string | null;
  parent_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
  children: CommentNode[];
};

export type UserMe = {
  id: number;
  nickname: string;
  cohort?: string;
  major?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  position?: string;
  profile_image_url?: string | null;
  profile_image_media_id?: number | null;
  email: string;
  role: string;
  created_at?: string | null;
  privacy_policy_version?: string | null;
  privacy_consented_at?: string | null;
};
