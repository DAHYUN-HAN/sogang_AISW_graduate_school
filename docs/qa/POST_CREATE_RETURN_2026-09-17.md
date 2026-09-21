# Post creation and board search return — 2026-09-17

Scope: WP5/WP9 P0 community writing and navigation.

## Reproduction and user clarification

- Community > Resources > Write > enter a title/body > close > Write restored the abandoned draft.
- A submitted resource-list search remained after opening Write and returning to the list.
- The reported search state is the board list's input/results, not a recent-search history feature.
- The user's final clarification specifically concerns the top search query continuing to filter the list after starting or finishing post creation. Draft contents are a separate concern.
- The hidden board tab retained both the create route and its originating list. The form key only changed for a different board, post or category.

## Change

- Leaving a new-post screen unmounts its form. Opening it again starts with empty text and attachments.
- Existing-post edits are not discarded solely because the screen loses focus.
- Opening Write clears the originating list's search input, submitted query and search UI. The selected board/category stays selected.
- Returning from a post detail keeps the existing search policy. In-form sheets and file selection do not trigger route blur.

## Verification

- Regression tests first failed for the retained new-post form and retained list search, then passed after the fix. Tests execute the actual screen wrapper and list handlers.
- Related navigation/regression suite: 92 passed. Full frontend test suite passed.
- TypeScript typecheck passed. Scoped ESLint: no errors, two existing duplicate-import warnings in the create screen. `git diff --check` passed.
- Local mobile web, 390 x 844: searched for `첨부파일` under Resources > `시험족보`, then opened Write. Search was cleared while the selected category remained.
- Entered a title/body and attached `attachment-edit-guide.pdf`. After file selection, the text remained and attachment count was 1.
- Closed Write: the list showed all three fixture posts and its normal search button. Reopened Write: title/body were empty and attachment count was 0; `시험족보` remained selected.
- Follow-up capture run repeated search > Write > title/body/PDF attachment > close > Write on mobile web (390 x 844) and desktop web (1280 x 900). Both cleared the list search and reset the abandoned draft including its attachment, while retaining `시험족보`.
- Search-specific follow-up: submitted `zz-no-match-0917` under Resources > All and verified zero results. Opened Write, entered a draft title, then used the app header close. Reopening search showed an empty input and all three original posts.
- Repeated the zero-result search, created the unrelated local fixture `Search reset QA 0917` (post 18), then returned via the detail header. Reopening search showed an empty input and all four posts, including the newly registered post.
- These follow-ups confirm the existing local `openCreate -> closeSearch` change clears both input and applied filter; no additional application change was needed. A separate browser-history Back attempt left the app for `about:blank`; it is not counted as a passing in-app Back test.

Screenshots (local ignored QA artifacts):

- `outputs/qa/image-viewer-2026-09-17/post-create-before-back-mobile.png`
- `outputs/qa/image-viewer-2026-09-17/post-create-search-cleared-mobile.png`
- `outputs/qa/image-viewer-2026-09-17/post-create-reset-mobile.png`
- Follow-up sequences for both `mobile` and `web`: `post-return-01-search-*.png`, `post-return-02-draft-*.png`, `post-return-03-search-reset-*.png`, `post-return-04-draft-reset-*.png` in the same artifact directory.
- Search-specific sequence: `board-search-01-filter-active.png`, `board-search-02-after-cancel.png`, `board-search-03-after-create.png` in the same artifact directory.

Verification used the isolated local QA server and test fixtures. The search-specific registration check created one local QA post; production data was not changed. Native Android/iOS device validation remains Phase 5 QA. This change is not deployed.
