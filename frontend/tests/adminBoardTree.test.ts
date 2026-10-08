import assert from "node:assert/strict";
import test from "node:test";
import type { Board } from "../types";
import { adminBoardParent, adminBoardSection, adminBoardSections, adminBoardCreationType, adminNoticeEditReady, adminBoardVisiblePage } from "../utils/adminBoardTree";

const board = (id: number, slug: string, category: string, type = "post", metadata?: Record<string, unknown>): Board => ({
  id, slug, name: slug, category, board_type: type, metadata, sort_order: id,
  allow_anonymous: false, read_permission: "user", write_permission: "user", is_active: true,
});

test("current taxonomy groups resource tags and participation modes without old notice menus", () => {
  const rows = [board(1, "lecture-reviews", "resources", "resource"), board(2, "exam-archive", "resources", "resource"),
    board(3, "club-promo", "club"), board(4, "club-activity", "participation", "activity_certification"),
    board(5, "webinar-notices", "notices", "notice"), board(6, "academic-calendar", "notices", "calendar")];
  const sections = adminBoardSections(rows);
  assert.deepEqual(sections.find(s => s.key === "resources")?.boardIds, [1, 2]);
  assert.deepEqual(sections.find(s => s.key === "club")?.boardIds, [3, 4]);
  assert.deepEqual(sections.find(s => s.key === "notices")?.boardIds, [5]);
  assert.equal(sections.some(s => s.label.includes("웨비나") || s.label.includes("학사 일정")), false);
  assert.equal(adminBoardSection(rows[5]), null);
});

test("custom child placement uses metadata and rejects malformed parent values", () => {
  const child = board(10, "new-resources", "resources", "resource", {admin_navigation:{section:"resources",parent_board_id:1}});
  assert.equal(adminBoardSection(child), "resources");
  assert.equal(adminBoardParent(child), 1);
  assert.equal(adminBoardParent({...child, metadata:{admin_navigation:{parent_board_id:true}}}), null);
  assert.equal(adminBoardParent({...child, metadata:{admin_navigation:{parent_board_id:-1}}}), null);
  assert.equal(adminBoardSection({...child, metadata:{admin_navigation:{section:"invented"}}}), "resources");
});

test("a child under dedicated introduction or FAQ boards gets an editable post type",()=>{
  assert.equal(adminBoardCreationType("executives",board(1,"gsa-executives","gsa","organization_intro")),"post");
  assert.equal(adminBoardCreationType("faq",board(2,"gsa-faq","gsa","faq")),"post");
  assert.equal(adminBoardCreationType("resources",board(3,"exam-archive","resources","resource")),"resource");
});
test("notice edit waits for both controller targets and active content before loading",()=>{
  assert.equal(adminNoticeEditReady(3,3,2,"content"),false);
  assert.equal(adminNoticeEditReady(3,2,3,"content"),false);
  assert.equal(adminNoticeEditReady(3,3,3,"settings"),false);
  assert.equal(adminNoticeEditReady(3,3,3,"content"),true);
});
test("deleting the final item of a last page returns to the remaining page",()=>{
  assert.equal(adminBoardVisiblePage(2,1),1);
  assert.equal(adminBoardVisiblePage(1,0),1);
  assert.equal(adminBoardVisiblePage(3,4),3);
});
