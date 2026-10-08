import assert from "node:assert/strict";
import test from "node:test";
import { createAdminDialogQueue } from "../utils/adminDialogQueue";

test("confirmation runs only the chosen action, after dismissing the dialog", () => {
  const queue = createAdminDialogQueue();
  const called: string[] = [];
  queue.push({ title: "삭제", buttons: [{ text: "취소", style: "cancel", onPress: () => called.push("cancel") }, { text: "삭제", onPress: () => { assert.equal(queue.current(), null); called.push("delete"); } }] });
  assert.deepEqual(called, []);
  queue.choose(1);
  queue.choose(1);
  assert.deepEqual(called, ["delete"]);
});

test("queued feedback and Escape cancellation preserve ordering", () => {
  const queue = createAdminDialogQueue();
  let cancelled = 0;
  queue.push({ title: "확인", buttons: [{ text: "취소", style: "cancel", onPress: () => cancelled++ }, { text: "진행" }] });
  queue.push({ title: "결과" });
  queue.cancel();
  assert.equal(cancelled, 1);
  assert.equal(queue.current()?.title, "결과");
  queue.choose(0);
  assert.equal(queue.current(), null);
});

test("noncancelable alerts cannot be dismissed through Escape", () => {
  const queue = createAdminDialogQueue();
  queue.push({ title: "확인", cancelable: false });
  queue.cancel();
  assert.equal(queue.current()?.title, "확인");
  queue.choose(0);
  assert.equal(queue.current(), null);
});

test("a stale rendered confirmation cannot select an action from the next dialog", () => {
  const queue = createAdminDialogQueue();
  let deleted = false;
  queue.push({title: "A"});
  const stale = queue.current()!;
  queue.choose(0);
  queue.push({title: "B", buttons: [{onPress: () => {deleted = true;}}]});
  queue.choose(0, stale);
  assert.equal(deleted, false);
  assert.equal(queue.current()?.title, "B");
});

test("session invalidation while publishing dismissal prevents the selected callback", () => {
  const queue = createAdminDialogQueue();
  let deleted = false;
  queue.push({title: "A", buttons: [{onPress: () => {deleted = true;}}]});
  const unsubscribe = queue.subscribe(() => {unsubscribe(); queue.clear();});
  queue.choose(0);
  assert.equal(deleted, false);
});
