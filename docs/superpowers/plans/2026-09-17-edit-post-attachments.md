# Member attachment editing implementation plan

**Goal:** Display and manage existing community photos/documents and a requester's editable mutual-aid evidence.

**Spec:** User-approved follow-up to `docs/qa/USER_ATTACHMENT_UPLOAD_AUDIT_2026-09-17.md`. Existing checkpoint: `8c8ccd0`. WP5/WP9 P0 attachment edit parity. No deployment, migration or package build.

**Architecture:** Reuse an attachment editor for generic member create/edit and mutual-aid file fields. Keep attachment edits local until saving the resulting IDs. Existing image and document pickers and signed media URLs remain in use. The backend exposes private evidence only to admins or the processing request's author in an explicit edit response. Ordinary post responses remain redacted.

## Contract and constraints

- `GET /api/posts/{id}?for_edit=true` checks ownership/admin and editable mutual-aid status; only this response exposes the requester's evidence list and `proof_url`. Normal responses continue to hide them from members.
- `usePostDetail(id, enabled, forEdit)` uses a distinct edit query key under the existing post prefix. Both edit screens request edit data.
- `PostUpdate.replace_evidence: bool = false` distinguishes an explicit mutual-aid replacement from legacy clients sending empty hidden evidence. New edit UI sends true, an explicit `attachment_ids` list, and `metadata.proof_url` (empty when using files).
- Explicit replacement validates at least one file OR a valid link; omission/legacy updates preserve existing evidence. Deleting the last file requires a replacement or link before saving. Completed/rejected requests remain locked.
- Media access for evidence requires admin OR an active, readable, processing mutual-aid request authored by the current user. Other members and completed/deleted request access fail closed, including old public evidence assets.
- Removing an attachment detaches it on save; it does not hard-delete stored bytes. Unchanged attachments and their order are preserved. Failed/cancelled replacement leaves the old entry intact.
- Community scope: all resource categories and retained generic community post routes. Do not add attachment support to study recruitment or suggestions; preserve specialized album/activity/guide flows.

## Task 1 — Backend evidence edit access

Files: `backend/app/routers/posts.py`, `backend/app/media_service.py`, `backend/app/schemas/post.py`, related backend tests.

- [x] Add failing API tests: owner edit data and signed access, peer redaction/denial, state locks, explicit subset removal/replacement, link/file switching, empty evidence rejection and legacy preservation.
- [x] Implement the contract above without schema changes. Preserve ordinary detail/list redaction and authorize stored bytes as well as metadata.
- [x] Run focused permission/media tests and broader backend regression checks. Review independently from frontend.

## Task 2 — Shared attachment editing UI

Files: new `frontend/components/PostAttachmentEditor.tsx`, `frontend/app/(tabs)/board/post/{create,edit/[postId]}.tsx`, `frontend/hooks/usePosts.ts`, `frontend/services/api.ts`, focused frontend tests.

- [x] Add a failing actual-screen test showing resource edit exposes image/document rows and removal/replacement changes submitted IDs.
- [x] Implement existing thumbnail/filename rows, open action, individual replace/delete and image/document add actions, with upload guards and cancellation/failure preservation.
- [x] Wire the same editor into ordinary member create and edit, and mutual-aid file selection. Hydrate once per post so refetch cannot overwrite pending changes.
- [x] Request explicit edit data and send explicit evidence replacement. Preserve proof link state; remove the stale hidden-evidence validation bypass.
- [x] Run focused tests, frontend typecheck/lint and full frontend tests.

## Task 3 — Integration and review

- [x] Update API/permission/route contracts and user-facing private-evidence copy for the newly authorized owner editing scope.
- [x] Exercise desktop/mobile-web community add/delete/replace and mutual-aid evidence edit flows using isolated fixture data. Confirm saved detail/edit state and unauthorized access tests. Native packaged/physical-device verification remains Phase 5 QA.
- [x] Request read-only code review; resolve findings and record validation/remaining device limits in QA notes and CODEX.md.

## Rulings

- Keep current requirement for evidence on a submitted mutual-aid request: individual deletion is supported, but saving no evidence requires replacing it with a file/link. This preserves the established form validation.
- Backend and frontend tasks may run independently against the contract above. Only assigned files are edited by each worker. Prior work is committed; new changes stay on `codex/edit-post-attachments`.

- Review follow-ups: isolate the root QueryClient and mounted forms by authenticated principal, clear retired caches, and wait for the current mount fetch before hydrating edits. An invalid ID does not remain loading.
- Implementation used the shared component directly; no separate attachmentEditing utility was needed. Runtime browser downloads use the existing signed attachment endpoint, preserving the editor without popup windows.
