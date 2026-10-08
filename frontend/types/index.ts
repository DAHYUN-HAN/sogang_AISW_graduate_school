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
  poll_summary?: {question_count: number; open_count: number; closed_count: number; participant_count: number} | null;
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

export type ActivityCertificationParticipantDetail = {
  id: number | null;
  label: string;
  is_paid_for_board: boolean | null;
};

export type PostDetail = {
  poll?: NoticePoll | null;
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
  activity_participants?: ActivityCertificationParticipantDetail[] | null;
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

export type NoticePollQuestion = {
  id: number; title: string; kind: "text" | "date"; allow_multiple: boolean;
  closed_at?: string | null; is_closed?: boolean; locked?: boolean;
  participant_count?: number; has_voted?: boolean; legacy?: boolean;
  options: {id: number; label: string; media_id: number | null; vote_count: number}[];
};
export type NoticePoll = {
  id: number; post_id: number; revision: number; ends_at: string | null; closed_at: string | null;
  locked: boolean; is_closed: boolean; participant_count: number; has_voted: boolean;
  questions: NoticePollQuestion[]; my_answers: {question_id: number; option_ids: number[]}[];
};
export type NoticePollDraft = {
  revision?: number; ends_at: string; locked?: boolean; is_closed?: boolean; participant_count?: number;
  questions: {id?: number; title: string; kind: "text" | "date"; allow_multiple: boolean;
    locked?: boolean; is_closed?: boolean; participant_count?: number; legacy?: boolean; saved_title?: string;
    options: {id?: number; label: string; media_id?: number | null}[]}[];
};
export type NoticePollPayload = {revision?: number; ends_at: string | null; questions: NoticePollDraft["questions"]};
export type NoticePollParticipant = {
  user_id: number; nickname: string; cohort: string | null;
  answers: {question_id: number; question_title: string; option_id: number; label: string}[];
};

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
  // 짝이 되는 공지. 관리자가 DB에서 직접 넣고, 열 수 있는 글일 때만 내려온다.
  notice_post_id?: number | null;
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
  // 일정 알림이 열 공지. 서버가 누를 때 기준으로 채워 준다.
  event_notice_post_id?: number | null;
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

export type AdminRosterItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
};

export type AdminDuesPaymentItem = AdminRosterItem & {
  payment_scope: DuesPaymentScope;
  once_board_id: number | null;
  once_board_name: string | null;
};

export type DuesPaymentWritePayload = {
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
  cleared: number;
  registered: number;
  total_rows: number;
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

export type AdminMainRequest = {
  id: number; board_id: number; kind: "mutual_aid" | "suggestion"; title: string;
  status: "processing" | "completed" | "rejected" | "received" | "answered";
  author_label: string; author_cohort?: string | null; received_at: string; handled_at: string | null;
};
export type AdminMainQueue = {
  items: AdminMainRequest[]; pending_count: number; today_handled_count: number;
  total: number; page: number; size: number; total_pages: number;
};
export type AdminMainOverview = {
  date: string; as_of: string;
  metrics: { visits_today: number | null; visitors_today: number | null; page_views_today: number | null;
    posts_today: number; posts_yesterday: number; comments_today: number; comments_yesterday: number };
  traffic: { status: "collecting" | "disabled" | "not_started"; started_at: string | null };
  pending: { mutual_aid: number; suggestions: number; reports: number };
  mutual_aid: AdminMainQueue; suggestions: AdminMainQueue;
};

export type AdminDashboardPageData<T> = {
  items: T[]; total: number; page: number; size: number; total_pages: number;
};
export type AdminDashboardPost = {
  id: number; board_id: number; board_name: string; title: string;
  author_label: string; author_cohort: string | null; created_at: string;
};
export type AdminDashboardComment = {
  id: number; post_id: number; board_id: number; post_title: string; content: string;
  author_label: string; author_cohort: string | null; created_at: string;
};
export type AdminDashboardOverview = {
  date: string; as_of: string;
  metrics: AdminMainOverview["metrics"];
  traffic: AdminMainOverview["traffic"];
  trend: { date: string; visits: number | null; visitors: number | null; page_views: number | null }[];
  posts: AdminDashboardPageData<AdminDashboardPost>;
  comments: AdminDashboardPageData<AdminDashboardComment>;
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
