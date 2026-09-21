// 글쓰기·수정 중에 하단 탭을 누르면 곧바로 옮기지 않고 확인부터 받는다.
//
// 탭바(`app/(tabs)/_layout.tsx`)는 폼 화면의 부모라 화면이 가진 뒤로가기
// 핸들러를 타지 않는다. iOS 스와이프를 usePreventRemove로 잡은 것과 같은 이유로,
// 폼 화면이 여기에 가로챌 함수를 걸어두고 탭바가 그것을 본다.
//
// 값이 바뀌어도 다시 그릴 것이 없어 store 대신 모듈 변수 하나만 둔다.
type WriteLeaveGuard = (proceed: () => void) => void;

let guard: WriteLeaveGuard | null = null;

/** 폼 화면이 떠날 때 반드시 null로 되돌려야 다른 화면에서 확인창이 새지 않는다. */
export function setWriteLeaveGuard(next: WriteLeaveGuard | null) {
  guard = next;
}

export function writeLeaveGuard(): WriteLeaveGuard | null {
  return guard;
}

/**
 * 확인이 필요하면 폼 화면에 넘기고 `true`를 준다. 이때 이동은 확인창에서
 * 사용자가 고른 뒤에 `proceed`로 일어난다. 걸린 것이 없으면 `false`라서
 * 부르는 쪽이 평소대로 이동하면 된다.
 */
export function requestWriteLeave(proceed: () => void): boolean {
  if (!guard) return false;
  guard(proceed);
  return true;
}
