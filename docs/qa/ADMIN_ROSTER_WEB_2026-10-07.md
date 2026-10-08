# 원우 명부 웹 테마 — 2026-10-07

Phase 4 WP8/WP9 P0. User requested the same theme as the administrator main and
member management for `/admin/roster`.

## Implemented

- White page, main typography/color tokens, compact bordered actions, one wrapping
  search/upload toolbar, and no duplicate page title or large colored help cards.
- Neutral guidance retains headerless XLSX `이름 / 전공 / 학번` column order,
  same-student-number updates, new entries and preservation of omitted students.
- Shared `AdminTable` renders name/student-number/major columns and the existing
  100-row server pagination. Its optional empty content supports roster loading,
  no-data/no-results and retry states without changing other table consumers.
- Enter search remains; reset clears both draft/applied search and returns to
  page one. Upload uses the original picker/import API, query invalidation and
  result/error dialogs, and its button is disabled while uploading.
- No inline identity/payment controls were added. Backend APIs, DB, upload rules,
  existing stored data and native presentation remain unchanged.

## Verified

- `npm run typecheck` and scoped ESLint: passed.
- Existing `duesPayerAdminUi.test.ts` and `duesPayers.test.ts`: **10/10 passed**,
  including identity-only columns, retained 100-row pagination and import summaries.
- Actual local browser: new toolbar, guide and three-column header; Enter search
  produced the no-results state, reset restored the unfiltered no-data state.
  Upload button was present and enabled. No actual workbook was chosen/uploaded.
- Browser default viewport/page width both 1169px, no page horizontal overflow;
  captured browser console error list was empty. No viewport override.
- This isolated preview has zero roster entries. Populated roster rows and
  multi-page navigation were not exercised interactively for this visual change.
  Original query/row mapping/page handlers remain, with existing contract tests
  passing. No data was seeded to alter the user's preview roster.
- Native/device and production PostgreSQL/Docker checks were not rerun for this
  frontend presentation change. No migration, release or deployment.

Evidence: `outputs/qa/admin-main-2026-10-07/roster-theme.png`.
