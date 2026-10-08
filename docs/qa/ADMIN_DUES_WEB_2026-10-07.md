# 원우회비 웹 테마 — 2026-10-07

Phase 4 WP8/WP9 P0. User requested the same theme as the administrator main and
roster for `/admin/dues`.

## Implemented

- White main typography/colors, compact search/upload toolbar, thin separators
  and a neutral upload guide retaining the full existing ALL/ONCE replacement rule.
- Blue underline tabs retain ordinary editing and individual one-time-registration
  modes. The same query/search state and existing editor-mode selection are used.
- Shared table columns: name, student number, major, scope, activity board, action.
  ALL/ONCE/UNPAID use compact green/blue/gray badges, and the activity board is
  displayed separately. Existing 100-row server pagination remains.
- Empty/loading/error table states, retry and search reset; no duplicate title.
- Payment editor uses white identity/separator rows, lighter type, neutral scope
  radios/board choices and a web footer outside the scroll area. Identity remains
  read-only; all scopes and board-specific one-time payloads remain. Web choices
  are disabled during saving.
- Upload confirmation uses the same white dialog theme, with the original
  replacement warning, failure-preservation message, cancel and Excel selection.
- Original workbook picker/import validation, update API, invalidation and
  result/error dialogs remain. Native presentation is retained. No API/DB change.

## Verified

- Typecheck and scoped ESLint passed.
- Existing `duesPayerAdminUi.test.ts`, `duesPayers.test.ts` and
  `duesPaymentEditorRender.test.ts`: **11/11 passed**. Includes read-only identity,
  three scopes, retained import confirmation and new-board requirement/disabled
  save on first one-time-registration render.
- Actual local browser: white six-column header, normal/one-time mode tabs,
  search Enter/no results, reset, upload warning dialog and cancellation.
  No Excel file was selected and no payment was changed.
- Default viewport/page width both 1169px, no page horizontal overflow; captured
  console error list was empty. No viewport override.
- The isolated preview roster is empty. Populated payment rows, paging and payment
  editing were not exercised interactively. Editor behavior was exercised by the
  existing SSR fixture; no fake roster/payment data was added to the preview.
- Native devices and production PostgreSQL/Docker were not rerun for this
  frontend theme change. No migration, release or deployment.

Evidence:

- `outputs/qa/admin-main-2026-10-07/dues-theme.png`
- `outputs/qa/admin-main-2026-10-07/dues-import-theme.png`
