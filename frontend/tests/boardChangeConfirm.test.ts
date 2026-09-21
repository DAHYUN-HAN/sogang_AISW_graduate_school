import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync("components/DiscardWriteModal.tsx", "utf8");
const createSource = readFileSync("app/(tabs)/board/post/create.tsx", "utf8");
const editSource = readFileSync("app/(tabs)/board/post/edit/[postId].tsx", "utf8");

test("게시판 변경 확인창 문구는 디자인에 적힌 문장을 그대로 쓴다", () => {
  // Figma Screen/Common/BoardChangeConfirmModal (node 1527:54)
  assert.match(modalSource, /boardChange: \{\s*title: "게시판을 변경하시겠어요\?",\s*body: "작성 중인 내용이 모두 사라져요\.",\s*keep: "취소",\s*discard: "변경",/);
  assert.match(modalSource, /BoardChangeConfirmModal \(node 1527:54\)/);
});

test("카드와 버튼은 기존 확인창과 같은 규격을 재사용한다", () => {
  // 디자인이 같아서 컴포넌트를 새로 만들지 않고 모드만 늘렸다.
  assert.match(modalSource, /"create" \| "edit" \| "boardChange"/);
  assert.match(modalSource, /borderRadius: 16,[\s\S]*?padding: 20,[\s\S]*?gap: 16,/);
  assert.match(modalSource, /backgroundColor: COLORS\.danger,/);
});

test("작성 화면은 확인을 받은 뒤에만 게시판을 바꾸고 폼을 비운다", () => {
  assert.match(createSource, /const \[pendingBoardId, setPendingBoardId\] = useState<number \| null>\(null\)/);
  assert.match(createSource, /onSelect=\{\(option\) => selectBoard\(Number\(option\.key\)\)\}/);
  // 확인 전에는 게시판을 바꾸지 않는다.
  assert.match(createSource, /setPendingBoardId\(nextBoardId\);/);
  assert.match(createSource, /mode="boardChange"/);
  // 확인하면 처음 상태로 되돌린다.
  for (const call of ["reset()", "setAttachments([])", "setSelectedParticipants([])", "setEvidenceLink(\"\")"]) {
    assert.ok(createSource.includes(call), `${call} 누락`);
  }
});

test("아무것도 안 썼으면 묻지 않고 바로 바꾼다", () => {
  assert.match(createSource, /if \(!hasUnsavedChanges\) \{\s*applyBoardChange\(nextBoardId\);/);
  assert.match(editSource, /if \(!hasDraftChanges\) \{\s*setSelectedBoardId\(nextBoardId\);/);
});

test("수정 화면은 비우지 않고 저장된 글로 되돌린다", () => {
  // 비우면 그대로 저장할 때 글 내용이 사라진다.
  assert.match(editSource, /hydrateFromPost\(\);\s*setSelectedBoardId\(pendingBoardId\);/);
  assert.doesNotMatch(editSource, /setPendingBoardId[\s\S]{0,200}setAttachments\(\[\]\)/);
});

test("수정 화면의 게시판 변경 확인은 게시판 이동 자체를 변경으로 세지 않는다", () => {
  // A->B 뒤 B->C에서 지울 내용이 없는데 다시 묻지 않도록 판정을 나눈다.
  assert.match(editSource, /const hasDraftChanges =\s*formState\.isDirty/);
  assert.match(editSource, /const hasUnsavedChanges =\s*hasDraftChanges\s*\|\|\s*\(selectedBoardId !== 0/);
  assert.match(editSource, /\[hasDraftChanges, selectedBoardId\]/);
});

test("같은 게시판을 다시 고르면 아무 일도 없다", () => {
  assert.match(createSource, /if \(nextBoardId === boardId\) return;/);
  assert.match(editSource, /if \(nextBoardId === selectedBoardId\) return;/);
});
