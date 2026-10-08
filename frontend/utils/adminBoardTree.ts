import type { Board } from "../types";
import type { AdminContentScope } from "./adminContentManagement";

export const ADMIN_BOARD_GROUPS = [
  {key:"council", label:"원우회"}, {key:"participation", label:"참여활동"},
  {key:"community", label:"커뮤니티"}, {key:"notices", label:"공지사항"},
] as const;
export const ADMIN_BOARD_SECTION_DEFINITIONS = [
  {key:"executives", label:"원우회 임원진 소개", scope:"council", category:"gsa", type:"organization_intro"},
  {key:"accounting", label:"회계장부", scope:"council", category:"council", type:"external_link"},
  {key:"mutual-aid", label:"원우회 상조회", scope:"council", category:"council", type:"mutual_aid"},
  {key:"cohort-leaders", label:"기수별 기장단 소개", scope:"council", category:"gsa", type:"organization_intro"},
  {key:"past-councils", label:"역대 원우회", scope:"council", category:"gsa", type:"organization_intro"},
  {key:"suggestions", label:"건의사항", scope:"council", category:"council", type:"suggestion"},
  {key:"faq", label:"자주 묻는 질문", scope:"council", category:"gsa", type:"faq"},
  {key:"club", label:"동아리", scope:"participation", category:"club", type:"post"},
  {key:"study", label:"스터디", scope:"participation", category:"study", type:"post"},
  {key:"networking", label:"네트워킹", scope:"participation", category:"alumni", type:"post"},
  {key:"album", label:"행사 사진첩", scope:"community", category:"community", type:"album"},
  {key:"resources", label:"자료공유", scope:"community", category:"resources", type:"resource"},
  {key:"notices", label:"공지사항", scope:"notices", category:"notices", type:"notice"},
] as const;
export type AdminBoardSectionKey = typeof ADMIN_BOARD_SECTION_DEFINITIONS[number]["key"];
export type AdminBoardSection = {key: AdminBoardSectionKey; label:string; scope:AdminContentScope; boardIds:number[]};
const slugs: Record<string, AdminBoardSectionKey> = {
  "gsa-executives":"executives", accounting:"accounting", "mutual-aid":"mutual-aid",
  "gsa-cohort-leaders":"cohort-leaders", "gsa-past-councils":"past-councils", suggestions:"suggestions", "gsa-faq":"faq",
  "club-promo":"club", "club-activity":"club", "study-recruit":"study", "study-activity":"study",
  "networking-programs":"networking", "networking-activity":"networking", "event-album":"album",
};
export function adminBoardParent(board: Board): number | null {
  const navigation = board.metadata?.admin_navigation as {parent_board_id?:unknown} | undefined;
  const id = navigation?.parent_board_id;
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}
export function adminBoardSection(board: Board): AdminBoardSectionKey | null {
  const navigation = board.metadata?.admin_navigation as {section?:unknown} | undefined;
  const stored = ADMIN_BOARD_SECTION_DEFINITIONS.find(s => s.key === navigation?.section);
  if (stored) return stored.key;
  if (slugs[board.slug]) return slugs[board.slug];
  if (board.category === "resources" && board.board_type === "resource") return "resources";
  if (board.category === "notices" && board.board_type === "notice") return "notices";
  return null;
}
export function adminBoardSections(boards: Board[]): AdminBoardSection[] {
  const sorted = [...boards].sort((a,b) => a.sort_order-b.sort_order || a.id-b.id);
  return ADMIN_BOARD_SECTION_DEFINITIONS.map(section => ({
    key:section.key, label:section.label, scope:section.scope,
    boardIds:sorted.filter(board => adminBoardSection(board) === section.key).map(board => board.id),
  }));
}
export function adminBoardTag(board: Board): string {
  if (board.board_type === "activity_certification") return "활동 인증";
  if (board.slug === "study-recruit") return "모집";
  if (board.slug === "club-promo") return "동아리 목록";
  if (board.slug === "networking-programs") return "행사 목록";
  return board.name;
}
export function adminParticipationBoards(section: AdminBoardSectionKey | null, boards: Board[]) {
  const slugs = section === "club"
    ? {guide: "club-promo", certification: "club-activity", createLabel: "동아리 등록", activityName: "동아리"}
    : section === "networking"
      ? {guide: "networking-programs", certification: "networking-activity", createLabel: "네트워킹 행사 등록", activityName: "네트워킹 행사"}
      : null;
  if (!slugs) return null;
  const active = (slug: string) => boards.find(board => board.slug === slug && board.is_active !== false && adminBoardSection(board) === section);
  return {...slugs, guide: active(slugs.guide), certification: active(slugs.certification)};
}
export function adminBoardCreationType(section: AdminBoardSectionKey, parent?: Board): string {
  const type=parent?.board_type ?? ADMIN_BOARD_SECTION_DEFINITIONS.find(s=>s.key===section)?.type ?? "post";
  return ["organization_intro","faq"].includes(type)?"post":type;
}
export function adminNoticeEditReady(postBoardId:number,managedBoardId:number|null,noticeBoardId:number|null,tab:string):boolean {
  return postBoardId===managedBoardId&&postBoardId===noticeBoardId&&tab==="content";
}
export function adminBoardVisiblePage(page:number,totalPages:number):number {return Math.min(page,Math.max(1,totalPages));}
