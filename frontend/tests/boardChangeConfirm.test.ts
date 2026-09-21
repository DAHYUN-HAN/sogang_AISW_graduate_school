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

test("작성 화면은 아무것도 안 썼으면 묻지 않고 바로 바꾼다", () => {
  assert.match(createSource, /if \(!hasUnsavedChanges\) \{\s*applyBoardChange\(nextBoardId\);/);
});

test("수정 화면은 늘 물어본다", () => {
  // 저장된 글이 이미 채워져 있어 비울 내용이 없는 경우가 없다.
  assert.doesNotMatch(editSource, /if \(!hasDraftChanges\)/);
  assert.match(editSource, /if \(nextBoardId === selectedBoardId\) return;[\s\S]{0,200}setPendingBoardId\(nextBoardId\);/);
});

test("수정 화면도 변경을 누르면 작성 화면처럼 내용을 비운다", () => {
  assert.match(editSource, /const clearForBoardChange = useCallback\(\(nextBoardId: number\) => \{/);
  for (const call of ["setSelectedBoardId(nextBoardId)", "reset(EMPTY_FORM)", "setAttachments([])", "clearErrors()"]) {
    assert.ok(editSource.includes(call), `${call} 누락`);
  }
  assert.match(editSource, /if \(pendingBoardId !== null\) clearForBoardChange\(pendingBoardId\);/);
  // 저장된 글로 되돌리던 예전 동작은 남기지 않는다.
  assert.doesNotMatch(editSource, /hydrateFromPost\(\);\s*setSelectedBoardId\(pendingBoardId\)/);
});

test("비울 때는 빈 값을 직접 넘긴다", () => {
  // reset(values)는 그 값을 새 기본값으로 삼는다. 저장된 글을 채운 뒤에
  // 인자 없는 reset()을 부르면 빈 폼이 아니라 그 글로 되돌아간다.
  assert.match(editSource, /const EMPTY_FORM: FormValues = \{/);
  assert.match(editSource, /defaultValues: EMPTY_FORM,/);
  assert.doesNotMatch(editSource, /^\s+reset\(\);$/m);
});

test("수정 화면의 게시판 선택도 아래에서 올라오는 시트를 쓴다", () => {
  // 작성 화면과 같은 컴포넌트를 쓴다. 각자 그리면 모양이 갈라진다.
  assert.match(editSource, /import SelectionSheet from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/SelectionSheet"/);
  assert.match(editSource, /<SelectionSheet\s+visible=\{isBoardMenuOpen\}/);
  assert.match(createSource, /import SelectionSheet, \{ type SelectionOption \} from "\.\.\/\.\.\/\.\.\/\.\.\/components\/SelectionSheet"/);
  // 칸 아래 펼치던 옛 목록은 남기지 않는다.
  assert.doesNotMatch(editSource, /styles\.boardMenu/);
  assert.doesNotMatch(editSource, /styles\.boardOption/);
  // 시트를 쓰므로 트리거 화살표는 늘 아래를 본다.
  assert.doesNotMatch(editSource, /isBoardMenuOpen \? "chevron-up"/);
});

test("나갈 때 확인은 내용·첨부와 게시판 이동을 모두 센다", () => {
  assert.match(
    editSource,
    /const hasUnsavedChanges =\s*formState\.isDirty[\s\S]{0,200}unsavedBaseline\.current\.boardId\);/,
  );
});

test("같은 게시판을 다시 고르면 아무 일도 없다", () => {
  assert.match(createSource, /if \(nextBoardId === boardId\) return;/);
  assert.match(editSource, /if \(nextBoardId === selectedBoardId\) return;/);
});
