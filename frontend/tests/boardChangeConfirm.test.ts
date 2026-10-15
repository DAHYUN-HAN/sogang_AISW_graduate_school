import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const modalSource = readFileSync("components/DiscardWriteModal.tsx", "utf8");
const createSource = readFileSync("app/(tabs)/(home,notices,community,participation,council)/board/post/create.tsx", "utf8");

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
  assert.match(createSource, /if \(!hasUnsavedChanges && !existingPost\) \{\s*applyBoardChange\(nextBoardId\);/);
});

// 글 수정은 글쓰기 화면(create.tsx)의 수정 모드다. 아래는 그 수정 모드의 게시판 이동(자료공유 게시판끼리)을 본다.
test("수정 화면은 늘 물어본다", () => {
  // 저장된 글이 이미 채워져 있어 비울 내용이 없는 경우가 없다.
  assert.match(createSource, /if \(nextBoardId === boardId\) return;[\s\S]{0,200}if \(!hasUnsavedChanges && !existingPost\)[\s\S]{0,100}setPendingBoardId\(nextBoardId\);/);
});

test("수정 화면도 변경을 누르면 작성 화면처럼 내용을 비운다", () => {
  assert.match(createSource, /const applyBoardChange = useCallback\(\(nextBoardId: number\) => \{/);
  const body = createSource.slice(createSource.indexOf("const applyBoardChange = useCallback"), createSource.indexOf("const selectBoard = useCallback"));
  for (const call of ["setBoardId(nextBoardId)", "reset(blankFormValues())", "setAttachments([])", "setSelectedParticipants([])", "setEvidenceLink(\"\")"]) {
    assert.ok(body.includes(call), `${call} 누락`);
  }
  // 첨부·참가자·증빙 링크의 기준선도 비워야 빈 폼이 "변경 없음"으로 잡히지 않는다.
  assert.match(body, /unsavedBaseline\.current = \{ attachmentIds: "", participantIds: "", evidenceLink: "" \};/);
  assert.match(createSource, /if \(pendingBoardId !== null\) applyBoardChange\(pendingBoardId\);/);
});

test("비울 때는 빈 값을 직접 넘긴다", () => {
  // reset(values)는 그 값을 새 기본값으로 삼는다. 저장된 글을 채운 뒤에
  // 인자 없는 reset()을 부르면 빈 폼이 아니라 그 글로 되돌아간다.
  assert.match(createSource, /function blankFormValues\(\): FormValues \{/);
  const body = createSource.slice(createSource.indexOf("const applyBoardChange = useCallback"), createSource.indexOf("const selectBoard = useCallback"));
  assert.doesNotMatch(body, /reset\(\);/);
  // 인자 없는 reset()은 작성 모드의 작성 취소에서만 쓴다.
  assert.match(createSource, /if \(!postId\) \{\s*reset\(\);/);
});

test("수정 화면의 게시판 선택도 아래에서 올라오는 시트를 쓴다", () => {
  // 작성 화면과 같은 컴포넌트를 쓴다. 수정할 때는 옮길 수 있는 자료공유 게시판만 보인다.
  assert.match(createSource, /import SelectionSheet, \{ type SelectionOption \} from "\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/components\/SelectionSheet"/);
  assert.match(createSource, /<SelectionSheet\s+visible=\{selectionSheet === "board"\}/);
  assert.match(createSource, /const editMoveBoards = useMemo\(\(\) => resourcePostEditBoards\(boards, originalBoard\), \[boards, originalBoard\]\);/);
  assert.match(createSource, /const canPickBoard = postId\s*\? editMoveBoards\.length > 0/);
  assert.match(createSource, /if \(postId\) return editMoveBoards;/);
  // 칸 아래 펼치던 옛 목록은 남기지 않는다.
  assert.doesNotMatch(createSource, /styles\.boardMenu/);
  assert.doesNotMatch(createSource, /styles\.boardOption/);
});

test("나갈 때 확인은 내용·첨부와 게시판 이동을 모두 센다", () => {
  assert.match(
    createSource,
    /const hasUnsavedChanges =\s*formState\.isDirty[\s\S]{0,500}Boolean\(existingPost && boardId !== existingPost\.board_id\);/,
  );
});

test("같은 게시판을 다시 고르면 아무 일도 없다", () => {
  assert.match(createSource, /if \(nextBoardId === boardId\) return;/);
});
