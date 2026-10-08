import assert from "node:assert/strict";
import test from "node:test";
import { readAdminImplementation } from "./helpers/adminImplementation";

import { eventCategoryValueForSubmit } from "../utils/eventCategoryPresentation";
import { adminEventFormRouteTransition } from "../utils/adminEventForm";

const adminSource = readAdminImplementation();

test("일정 편집에서 새 일정 폼으로 이동하면 폼을 초기화하고 선택한 3종 category를 그대로 저장한다", () => {
  const transition = adminEventFormRouteTransition({
    previousEditEventId: 42,
    nextEditEventId: null,
  });

  assert.deepEqual(transition, {
    shouldResetForm: true,
  });
  assert.equal(eventCategoryValueForSubmit("event"), "event");
});

test("관리자 화면은 편집에서 새 일정 폼으로 바뀔 때 하나의 guarded transition에서 editor 상태를 비운다", () => {
  const transitionEffect = adminSource.match(
    /useEffect\(\(\) => \{\r?\n    const transition = adminEventFormRouteTransition\([\s\S]*?\r?\n  \}, \[editEventId, reset\]\);/,
  )?.[0];

  assert.ok(transitionEffect, "edit-to-new route transition effect must exist");
  assert.match(transitionEffect, /previousEditEventId:\s*eventFormEditIdRef\.current/);
  assert.match(transitionEffect, /nextEditEventId:\s*editEventId/);
  assert.match(transitionEffect, /if \(!transition\.shouldResetForm\) return;/);
  assert.doesNotMatch(transitionEffect, /eventOriginalCategoryRef/);
  assert.doesNotMatch(transitionEffect, /eventCategoryExplicitlySelectedRef/);
  assert.match(transitionEffect, /reset\(emptyEvent\);/);
});
