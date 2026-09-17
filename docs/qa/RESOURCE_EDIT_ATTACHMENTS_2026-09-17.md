# Resource post edit attachments — investigation, 2026-09-17

WP5/WP9, `Phase 5 QA`. User report: after creating a resource-sharing post with photos, its edit screen cannot add or remove photos.

## Result

Reproduced on the current source in Pixel 7 / Android 16 / Expo Go using the existing isolated localhost fixture. A member-owned `exam-archive` post with three images displays all images in detail. Opening More > Edit shows only board selection, title, body and the completion button. There is no attachment list, add action or removal control.

Evidence: `outputs/qa/image-viewer-2026-09-17/resource-edit-missing-attachments.png` and matching UI XML; detail/menu evidence: `resource-edit-menu.png` and XML. Fixture post ID 9 was seeded locally, not created through the composer during this investigation. No post was saved or production data changed.

## Cause

- `frontend/app/(tabs)/board/post/edit/[postId].tsx` initializes existing attachments at line 101 and sends their IDs at line 227.
- However, the attachment-management JSX at line 467 is rendered only when `isAdminParticipationPost || isAlbum`. Resource boards satisfy neither condition, so loaded attachments have no editable UI.
- The create screen has attachment UI; resource edits route to this separate edit screen through `postEditRouteForPostDetail`. This explains the create/edit mismatch.
- Backend source already accepts `attachment_ids` on update and replaces the attachment relations (`backend/app/routers/posts.py`, `_replace_attachments` and `update_post`). No API rejection was triggered in this check: users cannot reach attachment edits in the UI.
- All resource categories using this shared screen are affected by the same condition; Android exam-archive was runtime verified. Web uses this same component but was not separately exercised in this investigation. The same restriction also hides non-image file management for resources.

## Repair direction

Add resource attachment management to the edit screen: existing image/file previews, individual removal, and new uploads, then save the resulting IDs through the existing update payload. Confirm addition, deletion, replacement and mixed image/document preservation after reopening the post. No application code changes were made for this investigation.
