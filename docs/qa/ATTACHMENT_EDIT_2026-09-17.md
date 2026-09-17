# Member attachment editing — 2026-09-17

WP5/WP9 P0, user-approved follow-up to the non-admin upload audit. Prior work was committed as `8c8ccd0`; this implementation is on `codex/edit-post-attachments`.

## Implemented behavior

- Community resource categories (lecture reviews, exam archive, comprehensive exam, graduation thesis) and retained generic community routes display existing photos/documents during editing. Rows show thumbnail/file name, open, change and delete actions. Photo/file addition is available; generic creation reuses the editor.
- Replacement retains the row position and unrelated files. Cancelled/failed uploads leave the previous file in place. Local removal changes the stored relation only after successful submission. Image opening uses the existing modal; web documents use signed attachment downloads, preserving the form without popup windows.
- The author of a processing mutual-aid request can retrieve their existing evidence through `for_edit=true`, preview/open, individually replace/remove, add private uploads, or switch between files and a proof link. Saving still requires at least one file or valid HTTP(S) link. Ordinary member responses remain redacted; peers and non-processing requesters cannot obtain evidence metadata/access URLs. Admin evidence access is retained.
- `replace_evidence=false` remains the API default for older clients. New edits explicitly send remaining IDs plus `metadata.proof_url`, including an empty string when clearing a previous link. No migration or physical file deletion is introduced.
- Account changes replace the root query cache and mounted form state. Edit forms await a fresh mount fetch before their one-time hydration; subsequent background refetches do not replace pending edits.

Specialized album/activity/administrator guide controls retain their prior scope. Study recruitment and suggestions do not gain upload controls.

## Verification

- Backend: focused evidence tests changed from 20 expected failures to 30 passing; full suite **422 passed, 1 skipped**. Compile/import/OpenAPI checks pass. One pre-existing Starlette/httpx deprecation warning remains.
- Frontend: **640 passed**. New tests execute actual component callbacks, screen expressions and query/root logic: existing mixed attachments, removal, replacement order, cancellation/failure preservation, private upload flags, download opening, explicit evidence payload, account isolation and fresh hydration. Existing splash mocks were extended for the new cache lifecycle without weakening splash assertions.
- Typecheck passes; changed-file lint has zero errors and two pre-existing duplicate-import warnings in the create form. Whitespace check passes.
- Independent read-only review found account cache reuse and stale initial edit hydration; both were reproduced in tests, corrected and re-reviewed. The invalid-ID loading follow-up was also corrected and tested.

## Local browser exercise

Disposable local SQLite/upload fixture, authenticated test member, API `127.0.0.1:8000`, Expo web `localhost:8086`. No production data or external service was changed.

1. Resource post 11 started with photo ID 4 and PDF ID 5. The UI removed the photo, replaced the PDF with an image and added a PDF. Save/reopen and API checks confirm only IDs 10/11 remain in order.
2. The document action emitted a browser download event while retaining the edit URL/form. Initial popup-based opening failed this runtime check and was replaced with the established signed-download behavior.
3. Mutual-aid post 12 started with private IDs 6/7. The owner previewed the image in the modal, removed it, replaced the PDF and saved. Edit response contained only replacement ID 12; ordinary detail returned no attachments.
4. Deleting the final evidence displayed the required-evidence notice and did not save. Switching to a proof link saved and reopened with that value. Switching back to private files saved IDs 13/14, cleared the link and preserved ordinary-detail redaction.
5. Desktop 1280×720 and mobile-web 390×844 screenshots show the shared controls without horizontal overflow. This is responsive web evidence, not an Android/iOS device run.

Artifacts under `outputs/qa/image-viewer-2026-09-17/` (local ignored QA output):

- `attachment-edit-community-web.png`
- `attachment-edit-community-mobile.png`
- `attachment-edit-mutual-aid-web.png`
- `attachment-edit-mutual-aid-mobile.png`
- `attachment-edit-tests.log`, `attachment-edit-runtime.json`, `attachment-edit-roundtrip.json`

## Limits

- Native package and physical Android/iOS verification remain **Phase 5 QA**. No APK, deployment or release work was performed.
- Previously issued signed URLs keep the existing expiry behavior; this change does not introduce immediate revocation. Detached uploads are not physically purged by editing.

## Registration versus editing comparison

Follow-up inspection, 2026-09-17. No application code changed during this comparison. Source and local responsive-web screens were compared with the same title/body/photo/PDF.

| Area | Registration | Editing |
| --- | --- | --- |
| Community attachments | Starts empty; added uploads show thumbnail/name and open/change/delete | Hydrates saved attachments; same component and controls |
| Community title | Single-line input, measured 43px on mobile web | Multiline textarea, fixed 100px |
| Community body | Minimum 100px on web; shared native capped/nested body wrapper | Fixed 116px; plain multiline input |
| Required body error | Form notice modal | Inline error below field |
| Community submit label | 등록 | 완료 |
| Mutual-aid form | Blank existing-value state; 신청 | Same form with stored fields/evidence; 변경사항 저장 |
| Mutual-aid evidence requirement | At least one file or valid proof link | Same requirement; processing owner only |

The community attachment UI is shared, but the surrounding create and edit forms remain separate. Consolidating their title/body controls, validation feedback and action wording would remove the remaining inconsistency. Mutual-aid already reuses the same form. Its shared file-mode tab still reads `이미지 첨부` although the file picker supports documents; `파일 첨부` would describe the behavior more accurately.

Runtime observations: both community attachment lists exposed open/change/delete plus photo/file addition; registration and edit missing-body validation were observed separately. The local registration comparison also created disposable post 13. Existing post 11 was not changed by the validation check. Mutual-aid create and edit showed the same field order and evidence controls, with empty versus prefilled values.

Mobile-web 390×844 comparison captures: `outputs/qa/image-viewer-2026-09-17/attachment-compare-community-create-mobile.png` and `attachment-compare-community-edit-mobile.png`. Native long-body differences above are source observations, not new device verification.
