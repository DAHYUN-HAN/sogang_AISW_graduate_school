# Dues Payment Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the current dues-payer roster into a full student roster with `ALL`, single-board `ONCE`, and `UNPAID` states, then prove the administrator and activity-certification flows with automated tests and screenshots.

**Architecture:** Keep `dues_payers` as the single identity-and-payment table and derive the three public states from `is_full_paid` plus nullable `once_board_id`. Put state transitions and workbook application in a small backend service, keep the router responsible for HTTP validation/serialization, and expose only `is_paid_for_board` to member search. The frontend separates API types, pure presentation helpers, the administrator editor, and the activity search coloring so each boundary can be tested independently.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL/SQLite tests, Pydantic, React Native 0.81 with Expo Router 6, TanStack Query, TypeScript, Node test runner, Docker Compose QA, browser-based visual verification.

**Spec:** `docs/superpowers/specs/2026-09-23-dues-payment-scope-design.md`

## Global Constraints

- Keep one `dues_payers` table; do not add a payment-history or entitlement table.
- Database storage is `is_full_paid: bool` plus `once_board_id: int | null`; API scope values are exactly `ALL`, `ONCE`, and `UNPAID`.
- A payer cannot be both full-paid and board-specific; `ONCE` references exactly one active `activity_certification` board.
- Existing rows migrate to `ALL` so deployment preserves current behavior.
- A payment workbook is an authoritative full-payment snapshot: reset prior `ALL`, then activate exact student-number-and-name matches; retain omitted `ONCE` rows.
- Activity certification accepts paid and unpaid roster members. Payment status never blocks selection or post storage.
- Member search remains name-only and exposes only current-board effectiveness as `is_paid_for_board`.
- Activity search colors are exactly black `#212429` and gray `#8A919C`; remove the orange state and copy.
- Keep normalized API responses `{status, data}` and `{status, message, code}` and enforce all administrator mutations in the backend.
- Use Alembic for schema changes and preserve existing activity participant name snapshots.
- Add no new package dependency.

## Review Focus

- A payment workbook containing one unknown student number or mismatched name must return `DUES_IMPORT_ROSTER_MISMATCH` without resetting any existing `ALL` row; Task 2 adds the rollback test.
- An `ALL` request with `once_board_id`, or an `ONCE` request without a valid active activity board, must fail without changing the row; Tasks 1 and 3 cover database and API enforcement.
- Deleting an `ONCE` board must null the foreign key and make the payer `UNPAID`, while merely renaming the board must update the displayed name; Tasks 1 and 3 test both cases.
- Switching between activity-certification boards with the same search text must refetch board-specific eligibility instead of reusing the old query result; Task 6 includes `boardId` in the query key and tests both results.
- Existing activity posts with persisted participant IDs or legacy name-only snapshots must remain editable without rewriting history; Task 4 extends the current compatibility tests.

---

### Task 1: Payment-scope migration and model

**Files:**
- Create: `backend/alembic/versions/0028_dues_payment_scope.py`
- Modify: `backend/app/models/dues_payer.py`
- Modify: `backend/tests/test_dues_payer_migration.py`

**Interfaces:**
- Consumes: existing `dues_payers.id`, `boards.id`, and Alembic head `0027_event_category_cleanup`.
- Produces: `DuesPayer.is_full_paid: bool`, `DuesPayer.once_board_id: int | None`, constraint `ck_dues_payers_payment_scope`, foreign key `fk_dues_payers_once_board_id_boards`, and index `ix_dues_payers_once_board_id`.

- [ ] **Step 1: Add failing migration and model assertions**

Extend the migration test so it applies `0026_dues_payers`, inserts one legacy payer, creates the minimal `boards` table, applies `0028_dues_payment_scope`, and verifies the exact schema and backfill:

```python
assert migration.down_revision == "0027_event_category_cleanup"
columns = {column["name"]: column for column in inspector.get_columns("dues_payers")}
assert columns["is_full_paid"]["nullable"] is False
assert columns["once_board_id"]["nullable"] is True
assert connection.execute(
    sa.text("SELECT is_full_paid, once_board_id FROM dues_payers WHERE student_number = 'A74001'")
).one() == (True, None)
assert any(item["name"] == "ck_dues_payers_payment_scope" for item in inspector.get_check_constraints("dues_payers"))
assert any(item["name"] == "fk_dues_payers_once_board_id_boards" for item in inspector.get_foreign_keys("dues_payers"))
assert any(item["name"] == "ix_dues_payers_once_board_id" for item in inspector.get_indexes("dues_payers"))
```

Extend the model parity test:

```python
assert DuesPayer.__table__.c.is_full_paid.nullable is False
assert DuesPayer.__table__.c.once_board_id.nullable is True
assert "ck_dues_payers_payment_scope" in constraints
assert indexes["ix_dues_payers_once_board_id"] == ("once_board_id",)
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run from `backend`:

```powershell
python -m pytest -q tests/test_dues_payer_migration.py
```

Expected: FAIL because `0028_dues_payment_scope.py` and the two model attributes do not exist.

- [ ] **Step 3: Implement the Alembic migration**

Create the revision using batch operations so the SQLite migration test and PostgreSQL runtime both work:

```python
revision = "0028_dues_payment_scope"
down_revision = "0027_event_category_cleanup"

def upgrade() -> None:
    with op.batch_alter_table("dues_payers") as batch_op:
        batch_op.add_column(
            sa.Column("is_full_paid", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(sa.Column("once_board_id", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "ck_dues_payers_payment_scope",
            "NOT (is_full_paid AND once_board_id IS NOT NULL)",
        )
        batch_op.create_foreign_key(
            "fk_dues_payers_once_board_id_boards",
            "boards",
            ["once_board_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_dues_payers_once_board_id", ["once_board_id"])
    op.execute(sa.text("UPDATE dues_payers SET is_full_paid = TRUE, once_board_id = NULL"))

def downgrade() -> None:
    with op.batch_alter_table("dues_payers") as batch_op:
        batch_op.drop_index("ix_dues_payers_once_board_id")
        batch_op.drop_constraint("fk_dues_payers_once_board_id_boards", type_="foreignkey")
        batch_op.drop_constraint("ck_dues_payers_payment_scope", type_="check")
        batch_op.drop_column("once_board_id")
        batch_op.drop_column("is_full_paid")
```

- [ ] **Step 4: Align the SQLAlchemy model**

Add the columns, constraint, and index without changing the existing unique student-number rule:

```python
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint

__table_args__ = (
    UniqueConstraint("student_number", name="uq_dues_payers_student_number"),
    CheckConstraint(
        "NOT (is_full_paid AND once_board_id IS NOT NULL)",
        name="ck_dues_payers_payment_scope",
    ),
    Index("ix_dues_payers_name", "name"),
    Index("ix_dues_payers_once_board_id", "once_board_id"),
)

is_full_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
once_board_id: Mapped[int | None] = mapped_column(
    ForeignKey("boards.id", ondelete="SET NULL"),
    nullable=True,
)
```

- [ ] **Step 5: Add constraint and `ON DELETE SET NULL` behavior tests**

Add one ORM-level test that rejects `is_full_paid=True, once_board_id=<id>` and one migration-level test that deletes the referenced board with SQLite foreign keys enabled and observes `once_board_id is None`.

- [ ] **Step 6: Run the migration tests and verify GREEN**

```powershell
python -m pytest -q tests/test_dues_payer_migration.py
python -m alembic heads
```

Expected: tests PASS and the single head is `0028_dues_payment_scope`.

- [ ] **Step 7: Commit**

```powershell
git add backend/alembic/versions/0028_dues_payment_scope.py backend/app/models/dues_payer.py backend/tests/test_dues_payer_migration.py
git commit -m "feat: add dues payment scopes"
```

---

### Task 2: Atomic roster and payment workbook services

**Files:**
- Create: `backend/app/dues_payer_service.py`
- Modify: `backend/app/dues_payer_import.py`
- Modify: `backend/app/routers/dues_payers.py`
- Modify: `backend/tests/test_dues_payers.py`

**Interfaces:**
- Consumes: `DuesPayerRow`, `DuesPayer.is_full_paid`, and `DuesPayer.once_board_id` from Task 1.
- Produces: `import_roster(db, rows) -> dict[str, int]`, `apply_full_payment_snapshot(db, rows) -> dict[str, int]`, `POST /dues-payers/admin/roster/import`, and revised `POST /dues-payers/admin/import`.

- [ ] **Step 1: Replace the old upsert test with explicit roster and payment RED tests**

Add these cases to `test_dues_payers.py`:

```python
def test_roster_import_upserts_identity_without_changing_payment_scope(api) -> None:
    # Existing ONCE row remains ONCE while its major changes.
    response = _import_roster(api, [("검증현재행사", "AI", "A74002")])
    assert response.status_code == 200
    assert response.json()["data"] == {
        "created": 0, "updated": 1, "unchanged": 0, "total_rows": 1
    }

def test_payment_snapshot_resets_all_retains_omitted_once_and_promotes_included_once(api) -> None:
    response = _import_payments(api, [
        ("검증기존전체", "AI", "A74001"),
        ("검증현재행사", "AI", "A74002"),
    ])
    assert response.json()["data"] == {
        "activated": 1, "reset": 1, "unchanged": 1, "total_rows": 2
    }

def test_payment_snapshot_mismatch_rolls_back_before_reset(api) -> None:
    before = _payment_states(api)
    response = _import_payments(api, [("다른이름", "AI", "A74001")])
    assert response.status_code == 422
    assert response.json()["code"] == "DUES_IMPORT_ROSTER_MISMATCH"
    assert _payment_states(api) == before
```

The fixture rows must include an omitted `ALL`, an omitted `ONCE`, an included `ONCE`, and an `UNPAID` row so every transition is observable.

- [ ] **Step 2: Run the workbook tests and verify RED**

```powershell
python -m pytest -q tests/test_dues_payers.py -k "roster_import or payment_snapshot"
```

Expected: FAIL because the roster endpoint and new result contract do not exist.

- [ ] **Step 3: Extract shared upload parsing**

Keep `parse_dues_payer_workbook(content)` unchanged for row validation and add a router helper that performs filename, size, read, and close exactly once per endpoint:

```python
async def _parse_workbook_upload(file: UploadFile) -> list[DuesPayerRow]:
    try:
        if Path(file.filename or "").suffix.lower() != ".xlsx":
            raise AppException(
                status_code=422,
                message="Only .xlsx workbooks are supported.",
                code="INVALID_DUES_WORKBOOK",
            )
        content = await file.read(settings.media_upload_max_bytes + 1)
        if len(content) > settings.media_upload_max_bytes:
            raise AppException(
                status_code=413,
                message="The workbook is too large.",
                code="PAYLOAD_TOO_LARGE",
            )
        return parse_dues_payer_workbook(content)
    finally:
        await file.close()
```

- [ ] **Step 4: Implement the service functions**

Create a focused service with exact-name matching after the parser has trimmed surrounding whitespace:

```python
def import_roster(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    existing = {
        item.student_number: item
        for item in db.scalars(
            select(DuesPayer)
            .where(DuesPayer.student_number.in_([row.student_number for row in rows]))
            .with_for_update()
        ).all()
    }
    created = updated = unchanged = 0
    for row in rows:
        item = existing.get(row.student_number)
        if item is None:
            db.add(DuesPayer(
                name=row.name,
                major=row.major,
                student_number=row.student_number,
                is_full_paid=False,
                once_board_id=None,
            ))
            created += 1
        elif (item.name, item.major) != (row.name, row.major):
            item.name, item.major = row.name, row.major
            updated += 1
        else:
            unchanged += 1
    return {"created": created, "updated": updated, "unchanged": unchanged, "total_rows": len(rows)}

def apply_full_payment_snapshot(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    roster = db.scalars(select(DuesPayer).with_for_update()).all()
    by_number = {item.student_number: item for item in roster}
    matched: list[DuesPayer] = []
    for row in rows:
        item = by_number.get(row.student_number)
        if item is None or item.name.strip() != row.name:
            raise AppException(
                status_code=422,
                message=f"Row {row.row_number} does not match the student roster.",
                code="DUES_IMPORT_ROSTER_MISMATCH",
            )
        matched.append(item)

    matched_ids = {item.id for item in matched}
    activated = sum(not item.is_full_paid for item in matched)
    unchanged = len(matched) - activated
    reset = sum(item.is_full_paid and item.id not in matched_ids for item in roster)
    for item in roster:
        if item.id in matched_ids:
            item.is_full_paid = True
            item.once_board_id = None
        elif item.is_full_paid:
            item.is_full_paid = False
    return {"activated": activated, "reset": reset, "unchanged": unchanged, "total_rows": len(rows)}
```

- [ ] **Step 5: Wire both administrator endpoints and audit actions**

Use these actions and commit only after the service returns successfully:

```python
@router.post("/admin/roster/import")
async def import_dues_roster(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = await _parse_workbook_upload(file)
    result = import_roster(db, rows)
    log_admin_action(db, actor_id=admin.id, action="dues_payer.roster_import", target_type="dues_payer", details=result)
    db.commit()
    return success_response(result)

@router.post("/admin/import")
async def import_full_payments(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    rows = await _parse_workbook_upload(file)
    result = apply_full_payment_snapshot(db, rows)
    log_admin_action(db, actor_id=admin.id, action="dues_payer.payment_import", target_type="dues_payer", details=result)
    db.commit()
    return success_response(result)
```

- [ ] **Step 6: Assert audit logs contain counts but no names or student numbers**

```python
details = [log.details for log in db.scalars(select(OperationalAuditLog)).all()]
assert any(item.get("activated") == 1 for item in details)
assert "검증" not in str(details)
assert "A740" not in str(details)
```

- [ ] **Step 7: Run workbook and authorization tests**

```powershell
python -m pytest -q tests/test_dues_payers.py
```

Expected: PASS, including `.xlsx` validation, upload limit, atomic mismatch, admin-only access, and PII-free audit cases.

- [ ] **Step 8: Commit**

```powershell
git add backend/app/dues_payer_service.py backend/app/dues_payer_import.py backend/app/routers/dues_payers.py backend/tests/test_dues_payers.py
git commit -m "feat: separate roster and payment imports"
```

---

### Task 3: Administrator individual payment management

**Files:**
- Modify: `backend/app/dues_payer_service.py`
- Modify: `backend/app/schemas/dues_payer.py`
- Modify: `backend/app/routers/dues_payers.py`
- Modify: `backend/tests/test_dues_payers.py`

**Interfaces:**
- Consumes: Task 1 model fields and Task 2 service module.
- Produces: `PaymentScope`, `DuesPayerWriteRequest`, `require_activity_dues_board`, `apply_payment_scope`, `POST /admin/payers`, `PUT /admin/payers/{payer_id}`, and enriched admin list items.

- [ ] **Step 1: Write failing request-validation and CRUD tests**

Cover all three states, duplicate student number, missing payer, non-activity board, inactive activity board, and member authorization:

```python
@pytest.mark.parametrize(
    ("scope", "once_board_id", "expected_full"),
    [("ALL", None, True), ("ONCE", 12, False), ("UNPAID", None, False)],
)
def test_admin_can_create_each_payment_scope(api, scope, once_board_id, expected_full):
    response = api.client.post(
        "/api/dues-payers/admin/payers",
        headers=api.headers["admin"],
        json={
            "name": f"검증{scope}",
            "major": "인공지능",
            "student_number": _student_number(scope),
            "payment_scope": scope,
            "once_board_id": once_board_id,
        },
    )
    assert response.status_code == 200
    assert response.json()["data"]["payment_scope"] == scope
    assert response.json()["data"]["is_full_paid"] is expected_full

def test_all_rejects_once_board_and_once_requires_active_activity_board(api):
    assert _create(api, "ALL", 12).json()["code"] == "INVALID_DUES_SCOPE"
    assert _create(api, "ONCE", None).json()["code"] == "INVALID_DUES_SCOPE"
    assert _create(api, "ONCE", NON_ACTIVITY_BOARD_ID).json()["code"] == "INVALID_DUES_BOARD"
```

- [ ] **Step 2: Run the focused CRUD tests and verify RED**

```powershell
python -m pytest -q tests/test_dues_payers.py -k "payment_scope or admin_can_create or invalid_dues"
```

Expected: FAIL because the request model and endpoints do not exist.

- [ ] **Step 3: Add strict Pydantic schemas**

```python
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

PaymentScope = Literal["ALL", "ONCE", "UNPAID"]

class DuesPayerWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=50)
    major: str = Field(min_length=1, max_length=100)
    student_number: str = Field(pattern=r"^[Aa]\d{5}$")
    payment_scope: PaymentScope
    once_board_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_scope(self):
        if self.payment_scope == "ONCE" and self.once_board_id is None:
            raise ValueError("ONCE requires once_board_id")
        if self.payment_scope != "ONCE" and self.once_board_id is not None:
            raise ValueError("once_board_id is allowed only for ONCE")
        return self
```

Map Pydantic shape errors to the normal `422 VALIDATION_ERROR`; reserve `INVALID_DUES_SCOPE` for explicit domain checks inside the service if a non-schema caller violates the invariant.

- [ ] **Step 4: Implement board and state helpers**

```python
def payment_scope(item: DuesPayer) -> str:
    if item.is_full_paid:
        return "ALL"
    return "ONCE" if item.once_board_id is not None else "UNPAID"

def require_activity_dues_board(db: Session, board_id: int) -> Board:
    board = db.get(Board, board_id)
    if board is None or not board.is_active or board.board_type != "activity_certification":
        raise AppException(status_code=422, message="Select an active activity board.", code="INVALID_DUES_BOARD")
    return board

def apply_payment_scope(db: Session, item: DuesPayer, scope: str, once_board_id: int | None) -> Board | None:
    if scope == "ALL":
        item.is_full_paid, item.once_board_id = True, None
        return None
    if scope == "UNPAID":
        item.is_full_paid, item.once_board_id = False, None
        return None
    if scope == "ONCE" and once_board_id is not None:
        board = require_activity_dues_board(db, once_board_id)
        item.is_full_paid, item.once_board_id = False, board.id
        return board
    raise AppException(status_code=422, message="Invalid payment scope.", code="INVALID_DUES_SCOPE")
```

- [ ] **Step 5: Add create/update endpoints and enriched serializer**

Normalize request strings before persistence and catch the unique constraint as `409 DUES_STUDENT_NUMBER_CONFLICT`:

```python
def _admin_dues_payer_payload(item: DuesPayer, board_name: str | None = None) -> dict:
    return {
        "id": item.id,
        "name": item.name,
        "major": item.major,
        "student_number": item.student_number,
        "payment_scope": payment_scope(item),
        "is_full_paid": item.is_full_paid,
        "once_board_id": item.once_board_id,
        "once_board_name": board_name,
    }
```

Both mutations must write `dues_payer.create` or `dues_payer.update` audit actions with `{payer_id, payment_scope, once_board_id}` only. Do not log name, major, or student number.

- [ ] **Step 6: Join board names in the administrator list and verify rename/delete behavior**

Select `(DuesPayer, Board.name)` with an outer join on `once_board_id`. Add a test that renames the board and sees the new `once_board_name`, then deletes the board and sees `payment_scope == "UNPAID"` and `once_board_id is None`.

- [ ] **Step 7: Run the administrator API tests**

```powershell
python -m pytest -q tests/test_dues_payers.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/app/dues_payer_service.py backend/app/schemas/dues_payer.py backend/app/routers/dues_payers.py backend/tests/test_dues_payers.py
git commit -m "feat: manage individual dues payment scopes"
```

---

### Task 4: Board-aware member search and activity storage

**Files:**
- Modify: `backend/app/routers/dues_payers.py`
- Modify: `backend/app/routers/posts.py`
- Modify: `backend/tests/test_dues_payers.py`
- Modify: `backend/tests/test_activity_certification_dues_payers.py`

**Interfaces:**
- Consumes: `require_activity_dues_board` from Task 3 and existing activity metadata canonicalization.
- Produces: `GET /dues-payers/search?q=<name>&board_id=<id>&size=<n>` items with `is_paid_for_board: bool`.

- [ ] **Step 1: Write the four-state search matrix test**

Seed `ALL`, current-board `ONCE`, other-board `ONCE`, and `UNPAID`, all sharing the name prefix `검증`, then assert:

```python
response = api.client.get(
    "/api/dues-payers/search",
    params={"q": "검증", "board_id": CURRENT_ACTIVITY_BOARD_ID},
    headers=api.headers["owner"],
)
assert [(item["name"], item["is_paid_for_board"]) for item in response.json()["data"]] == [
    ("검증기존전체", True),
    ("검증다른행사", False),
    ("검증미납", False),
    ("검증현재행사", True),
]
assert all("payment_scope" not in item and "once_board_id" not in item for item in response.json()["data"])
```

Also assert missing, inactive, ordinary, and unknown `board_id` values return `422 INVALID_DUES_BOARD`, and student-number text still returns no matches.

- [ ] **Step 2: Write the unpaid activity-post acceptance test**

Create a certification containing one `UNPAID` ID and one current-board `ONCE` ID:

```python
created = _create_activity_post(api, payer_ids=[unpaid.id, once.id])
assert created.status_code == 200
with api.session() as db:
    metadata = db.get(Post, created.json()["data"]["id"]).metadata_json
assert metadata["participant_dues_payer_ids"] == [unpaid.id, once.id]
assert metadata["participants"] == "74기 검증미납, 74기 검증현재행사"
```

- [ ] **Step 3: Run the search and activity tests and verify RED**

```powershell
python -m pytest -q tests/test_dues_payers.py -k "search"
python -m pytest -q tests/test_activity_certification_dues_payers.py -k "unpaid"
```

Expected: search test FAIL because `board_id` and `is_paid_for_board` are absent; the activity test documents that storage should already accept every existing roster row.

- [ ] **Step 4: Implement board-aware search serialization**

```python
@router.get("/search")
def search_dues_payers(
    q: str = Query(..., min_length=1),
    board_id: int = Query(..., ge=1),
    size: int = Query(8, ge=1, le=20),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    board = require_activity_dues_board(db, board_id)
    # Preserve the current name-only ILIKE query and ordering.
    return success_response([
        {
            "id": item.id,
            "name": item.name,
            "major": item.major,
            "student_number": item.student_number,
            "is_paid_for_board": item.is_full_paid or item.once_board_id == board.id,
        }
        for item in payers
    ])
```

- [ ] **Step 5: Update the activity validation wording without adding a payment gate**

Change `_invalid_dues_payer()` to refer to the student roster rather than the paid roster, but leave `_canonical_activity_metadata` checking only ID existence and order. Do not inspect `is_full_paid` or `once_board_id` in post creation/update.

- [ ] **Step 6: Extend historical edit compatibility tests**

Keep the assertions for unchanged persisted IDs and legacy name-only participants, then change the payer state between read and edit and confirm the stored participant snapshot remains unchanged.

- [ ] **Step 7: Run the complete backend feature slice**

```powershell
python -m pytest -q tests/test_dues_payer_migration.py tests/test_dues_payers.py tests/test_activity_certification_dues_payers.py
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add backend/app/routers/dues_payers.py backend/app/routers/posts.py backend/tests/test_dues_payers.py backend/tests/test_activity_certification_dues_payers.py
git commit -m "feat: search all activity participants by board"
```

---

### Task 5: Frontend API contracts and administrator editor

**Files:**
- Modify: `frontend/types/index.ts`
- Modify: `frontend/services/api.ts`
- Modify: `frontend/utils/duesPayers.ts`
- Create: `frontend/components/admin/DuesPayerEditor.tsx`
- Modify: `frontend/components/admin/DuesPayerSection.tsx`
- Modify: `frontend/tests/duesPayers.test.ts`
- Create: `frontend/tests/duesPayerAdminUi.test.ts`

**Interfaces:**
- Consumes: Task 2 and Task 3 API contracts plus the existing `Board` list.
- Produces: `DuesPaymentScope`, `DuesPayerSearchItem`, `AdminDuesPayerItem`, `DuesPayerWritePayload`, two workbook clients, individual create/update clients, and the administrator UI.

- [ ] **Step 1: Add failing pure-helper and source-contract tests**

```typescript
test("관리자 원우 상태는 전체·게시판 전용·미납으로 표시한다", () => {
  assert.equal(formatDuesScope({ payment_scope: "ALL", once_board_name: null }), "전체 납부");
  assert.equal(formatDuesScope({ payment_scope: "ONCE", once_board_name: "스터디 활동 인증" }), "1회 납부 · 스터디 활동 인증");
  assert.equal(formatDuesScope({ payment_scope: "UNPAID", once_board_name: null }), "미납");
});

test("전체 납부 업로드 결과는 활성·초기화·유지 수를 안내한다", () => {
  assert.equal(
    formatPaymentImportSummary({ activated: 2, reset: 3, unchanged: 4, total_rows: 6 }),
    "총 6명 · 전체 납부 전환 2명 · 미납 초기화 3명 · 유지 4명",
  );
});
```

Create `duesPayerAdminUi.test.ts` with `readFileSync` assertions against `components/admin/DuesPayerSection.tsx` and `components/admin/DuesPayerEditor.tsx`. It must require labels `전체 원우 명부 업로드`, `전체 납부자 업로드`, `개별 등록`, `전체 납부`, `특정 행사 1회 납부`, and `미납`.

- [ ] **Step 2: Run focused frontend tests and verify RED**

```powershell
npm run test -- --test-name-pattern="원우 상태|전체 납부 업로드|원우회비"
```

Expected: FAIL because the new helpers and UI strings do not exist.

- [ ] **Step 3: Define exact frontend types**

```typescript
export type DuesPaymentScope = "ALL" | "ONCE" | "UNPAID";

export type DuesPayerSearchItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
  is_paid_for_board: boolean;
};

export type AdminDuesPayerItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
  payment_scope: DuesPaymentScope;
  is_full_paid: boolean;
  once_board_id: number | null;
  once_board_name: string | null;
};

export type DuesPayerWritePayload = {
  name: string;
  major: string;
  student_number: string;
  payment_scope: DuesPaymentScope;
  once_board_id: number | null;
};
```

Add distinct `DuesRosterImportResult` and `DuesPaymentImportResult` types rather than one ambiguous import result.

- [ ] **Step 4: Implement the API client methods**

```typescript
search: async (q: string, boardId: number, size = 8) =>
  api.get<ApiSuccess<DuesPayerSearchItem[]>>("/dues-payers/search", {
    params: { q, board_id: boardId, size },
  }),
importRosterWorkbook: (file) => postWorkbook("/dues-payers/admin/roster/import", file),
importPaymentWorkbook: (file) => postWorkbook("/dues-payers/admin/import", file),
createPayer: async (payload: DuesPayerWritePayload) =>
  api.post<ApiSuccess<AdminDuesPayerItem>>("/dues-payers/admin/payers", payload),
updatePayer: async (payerId: number, payload: DuesPayerWritePayload) =>
  api.put<ApiSuccess<AdminDuesPayerItem>>(`/dues-payers/admin/payers/${payerId}`, payload),
```

The shared `postWorkbook` must keep the current multipart headers and `MEDIA_UPLOAD_TIMEOUT_MS`.

- [ ] **Step 5: Implement pure labels and summaries**

```typescript
export function formatDuesScope(item: Pick<AdminDuesPayerItem, "payment_scope" | "once_board_name">) {
  if (item.payment_scope === "ALL") return "전체 납부";
  if (item.payment_scope === "ONCE") return `1회 납부 · ${item.once_board_name ?? "게시판 미지정"}`;
  return "미납";
}
```

Keep `formatDuesPayer` for identity display and split roster/payment import summary functions.

- [ ] **Step 6: Create the individual editor**

`DuesPayerEditor` must accept only active activity-certification boards and emit one normalized payload:

```typescript
type Props = {
  visible: boolean;
  item: AdminDuesPayerItem | null;
  activityBoards: Board[];
  saving: boolean;
  onClose: () => void;
  onSave: (payload: DuesPayerWritePayload) => void;
};

const [scope, setScope] = useState<DuesPaymentScope>(item?.payment_scope ?? "UNPAID");
const payload: DuesPayerWritePayload = {
  name: name.trim(),
  major: major.trim(),
  student_number: studentNumber.trim().toUpperCase(),
  payment_scope: scope,
  once_board_id: scope === "ONCE" ? selectedBoardId : null,
};
```

Render three scope choices. Render the board picker only for `ONCE`. Disable save when identity fields are blank, the student number does not match `/^A\d{5}$/`, or `ONCE` has no board.

- [ ] **Step 7: Rework the administrator section around the two imports and editor**

Use separate `uploadingRoster` and `uploadingPayments` states and explicit buttons. Load the existing grouped board query and pass only valid ONCE targets to the editor:

```typescript
const { data: boardsResponse } = useBoardsQuery();
const activityBoards = (boardsResponse?.data ?? [])
  .flatMap((group) => group.boards)
  .filter((board) => board.is_active && board.board_type === "activity_certification");
```

The list card must show `formatDuesScope(payer)` and an edit action; `개별 등록` opens the editor with `item=null`. Type `getAdminPayers` as `ApiSuccess<AdminDuesPayerItem[]>`. After every import or mutation invalidate `['admin-dues-payers']` and show the corresponding summary.

- [ ] **Step 8: Run frontend tests and typecheck**

```powershell
npm run test -- --test-name-pattern="원우"
npm run typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit**

```powershell
git add frontend/types/index.ts frontend/services/api.ts frontend/utils/duesPayers.ts frontend/components/admin/DuesPayerEditor.tsx frontend/components/admin/DuesPayerSection.tsx frontend/tests/duesPayers.test.ts frontend/tests/duesPayerAdminUi.test.ts
git commit -m "feat: manage dues scopes in admin"
```

---

### Task 6: Black/gray activity participant presentation

**Files:**
- Modify: `frontend/utils/activityCertification.ts`
- Modify: `frontend/app/(tabs)/board/post/create.tsx`
- Modify: `frontend/tests/activityCertification.test.ts`
- Modify: `frontend/tests/pr17VisualContract.test.ts`

**Interfaces:**
- Consumes: `DuesPayerSearchItem.is_paid_for_board` and board-aware `duesPayerApi.search` from Task 5.
- Produces: `activityParticipantTextColor`, two-color guidance copy, and board-specific search query caching.

- [ ] **Step 1: Add failing color and copy tests**

```typescript
test("현재 게시판 납부 효력은 검정과 회색 두 색으로만 표시한다", () => {
  assert.equal(activityParticipantTextColor({ is_paid_for_board: true }), "#212429");
  assert.equal(activityParticipantTextColor({ is_paid_for_board: false }), "#8A919C");
  assert.match(ACTIVITY_PARTICIPANT_GUIDANCE, /검정.*납부.*회색.*미납/);
  assert.doesNotMatch(ACTIVITY_PARTICIPANT_GUIDANCE, /주황|5만원|1회 납부/);
});
```

Update the visual source test to require `activityParticipantTextColor(participant)` on both name and major text and to require `boardId` in the search query key.

- [ ] **Step 2: Run focused activity tests and verify RED**

```powershell
npm run test -- --test-name-pattern="납부 효력|참가자 검색 결과"
```

Expected: FAIL because the helper and board-aware styles are absent and the old guidance contains orange.

- [ ] **Step 3: Add the pure color helper and exact copy**

```typescript
export const ACTIVITY_PARTICIPANT_PAID_COLOR = "#212429";
export const ACTIVITY_PARTICIPANT_UNPAID_COLOR = "#8A919C";

export function activityParticipantTextColor(
  participant: Pick<DuesPayerSearchItem, "is_paid_for_board">,
) {
  return participant.is_paid_for_board
    ? ACTIVITY_PARTICIPANT_PAID_COLOR
    : ACTIVITY_PARTICIPANT_UNPAID_COLOR;
}

export function activityParticipantSearchKey(boardId: number, query: string) {
  return ["dues-payer-search", boardId, query] as const;
}

export const ACTIVITY_PARTICIPANT_GUIDANCE =
  "참가자 이름 색상 구분: 검정은 현재 활동 기준 납부, 회색은 현재 활동 기준 미납입니다. 지원금은 참가자 목록 기준 지급되니 본인도 검색해서 추가해주세요.";
```

- [ ] **Step 4: Make participant search board-specific**

```typescript
const participantSearch = useQuery({
  queryKey: activityParticipantSearchKey(boardId, trimmedParticipantQuery),
  queryFn: () => duesPayerApi.search(trimmedParticipantQuery, boardId, 8),
  enabled: isActivity && boardId > 0 && trimmedParticipantQuery.length > 0,
  retry: false,
});
```

Including `boardId` in both query key and request is mandatory so moving between activity boards cannot reuse the previous eligibility result.

- [ ] **Step 5: Apply black/gray to the complete result text without disabling either state**

```tsx
const participantColor = activityParticipantTextColor(participant);
<Text style={[styles.participantName, { color: participantColor }]}>
  {formatActivityParticipant(participant)}
</Text>
{participant.major ? (
  <Text style={[styles.participantMeta, { color: participantColor }]}>{participant.major}</Text>
) : null}
```

Keep the `Pressable` enabled for both paid and unpaid results. The only disabled case remains “already selected.” Remove hard-coded color comments that claim every result is a payer.

- [ ] **Step 6: Add the same-board/different-board cache regression test**

Test the `activityParticipantSearchKey` helper added in Step 3:

```typescript
assert.notDeepEqual(
  activityParticipantSearchKey(12, "검증"),
  activityParticipantSearchKey(13, "검증"),
);
```

- [ ] **Step 7: Run activity tests and typecheck**

```powershell
npm run test -- --test-name-pattern="활동 인증|참가자"
npm run typecheck
```

Expected: PASS and no orange copy remains in the activity form.

- [ ] **Step 8: Commit**

```powershell
git add frontend/utils/activityCertification.ts "frontend/app/(tabs)/board/post/create.tsx" frontend/tests/activityCertification.test.ts frontend/tests/pr17VisualContract.test.ts
git commit -m "feat: color activity participants by payment scope"
```

---

### Task 7: Contract documentation and full automated verification

**Files:**
- Modify: `docs/phase2/API_CONTRACT.md`
- Modify: `docs/phase2/DB_SCHEMA_DECISIONS.md`
- Modify: `docs/phase2/AUTH_PERMISSION_SPEC.md`
- Modify: `docs/phase2/FRONTEND_ROUTE_SPEC.md`
- Modify: `PLAN.md`
- Modify: `CODEX.md`

**Interfaces:**
- Consumes: all implemented backend and frontend contracts from Tasks 1–6.
- Produces: repository documentation that matches the migration, APIs, permissions, and visible administrator/member behavior.

- [ ] **Step 1: Update the phase contract files**

Document these exact contracts:

```text
dues_payers.is_full_paid BOOLEAN NOT NULL
dues_payers.once_board_id INTEGER NULL REFERENCES boards(id) ON DELETE SET NULL
CHECK NOT (is_full_paid AND once_board_id IS NOT NULL)
```

Document `POST /admin/roster/import`, revised payment snapshot `POST /admin/import`, individual create/update, and `GET /search` with required `board_id` and member-safe `is_paid_for_board`. State explicitly that only administrators mutate scope and that activity creation does not reject `UNPAID`.

- [ ] **Step 2: Update backlog status without overwriting unrelated entries**

Mark only the dues-payment-scope work package as implemented and list the visual evidence paths created by Task 8. Preserve unrelated user changes in `PLAN.md` and `CODEX.md`.

- [ ] **Step 3: Run backend verification**

From `backend`:

```powershell
python -m pytest -q
python -m alembic heads
python scripts/verify_backend.py
```

Expected: all tests PASS, exactly one Alembic head `0028_dues_payment_scope`, backend verification PASS. The existing Starlette `httpx` deprecation warning may remain; no new warning is acceptable.

- [ ] **Step 4: Run frontend verification**

From `frontend`:

```powershell
npm run test
npm run typecheck
npm run lint
```

Expected: all tests, typecheck, and lint PASS.

- [ ] **Step 5: Inspect the final diff**

```powershell
git diff --check
git status --short
git diff --stat origin/main...HEAD
```

Confirm no generated database, upload, build, secret, or dependency directory is tracked.

- [ ] **Step 6: Commit documentation**

```powershell
git add docs/phase2/API_CONTRACT.md docs/phase2/DB_SCHEMA_DECISIONS.md docs/phase2/AUTH_PERMISSION_SPEC.md docs/phase2/FRONTEND_ROUTE_SPEC.md PLAN.md CODEX.md
git commit -m "docs: document dues payment scope workflow"
```

---

### Task 8: Isolated visual verification and screenshots

**Files:**
- Create: `docs/qa/DUES_PAYMENT_SCOPE_VERIFICATION_2026-09-23.md`
- Create during QA: `docs/qa/evidence/dues-payment-scope/admin-bulk-payment.png`
- Create during QA: `docs/qa/evidence/dues-payment-scope/admin-once-board.png`
- Create during QA: `docs/qa/evidence/dues-payment-scope/activity-participant-colors.png`

**Interfaces:**
- Consumes: completed feature, isolated QA Compose stack, local demo administrator `test@sogang.ac.kr` / `password123`, and the computer-use browser workflow.
- Produces: three user-viewable screenshots and a written matrix tying each screenshot to API/database assertions.

- [ ] **Step 1: Start an isolated QA stack**

From the repository root, use a unique Compose project so existing development data is untouched:

```powershell
docker compose --env-file .env.qa.example -p aisw_dues_scope_qa -f docker-compose.yml -f docker-compose.qa.yml up -d --build db backend frontend-web
docker compose --env-file .env.qa.example -p aisw_dues_scope_qa -f docker-compose.yml -f docker-compose.qa.yml exec backend python -m app.migrate
docker compose --env-file .env.qa.example -p aisw_dues_scope_qa -f docker-compose.yml -f docker-compose.qa.yml exec backend python -c "from app.database import SessionLocal; from app.seed import seed_initial_data; db=SessionLocal(); seed_initial_data(db); db.close()"
```

Verify `http://127.0.0.1:58000/health/ready` and `http://127.0.0.1:58081` both respond successfully.

- [ ] **Step 2: Prepare deterministic QA identities**

Use the administrator UI and the two XLSX upload paths so the screenshots validate the real workflow, not direct database inserts. The roster file contains:

```text
검증기존전체 | 인공지능 | A74001
검증현재행사 | 인공지능 | A74002
검증미납     | 인공지능 | A74003
검증다른행사 | 인공지능 | A74004
```

The full-payment file contains only `검증기존전체`. After upload, use individual editing to set `검증현재행사` to `ONCE` for the activity board used in the screenshot and `검증다른행사` to `ONCE` for a different activity board. Leave `검증미납` as `UNPAID`.

Create the two temporary workbooks outside the repository with the installed `openpyxl` runtime:

```powershell
$duesQaFixtureDir = Join-Path $env:TEMP "aisw-dues-scope-qa"
New-Item -ItemType Directory -Force -Path $duesQaFixtureDir | Out-Null
python -c "from pathlib import Path; from openpyxl import Workbook; import sys; root=Path(sys.argv[1]); files={'roster.xlsx':[('검증기존전체','인공지능','A74001'),('검증현재행사','인공지능','A74002'),('검증미납','인공지능','A74003'),('검증다른행사','인공지능','A74004')],'payments.xlsx':[('검증기존전체','인공지능','A74001')]}; [(lambda wb, rows, path: ([wb.active.append(row) for row in rows], wb.save(path), wb.close()))(Workbook(), rows, root/name) for name, rows in files.items()]" "$duesQaFixtureDir"
```

Select `roster.xlsx` with `전체 원우 명부 업로드`, then select `payments.xlsx` with `전체 납부자 업로드`.

- [ ] **Step 3: Verify the backend matrix before visual capture**

Call member search for the screenshot board and record this exact matrix in the QA document:

```text
검증기존전체  ALL                    is_paid_for_board=true
검증현재행사  ONCE current board     is_paid_for_board=true
검증미납      UNPAID                 is_paid_for_board=false
검증다른행사  ONCE different board   is_paid_for_board=false
```

Also record that all four IDs can be submitted in one activity certification and that its response preserves all four participant names.

- [ ] **Step 4: Capture the administrator bulk-payment result**

Use the `computer-use` skill to open the Expo web app, log in as the local administrator, navigate to the dues section, perform the roster and payment uploads, and capture the list plus success result as `admin-bulk-payment.png`. The screenshot must visibly include the overall `ALL` status and at least one reset `UNPAID` status.

- [ ] **Step 5: Capture the board-specific individual assignment**

Open `검증현재행사`, select `특정 행사 1회 납부`, choose the current activity-certification board, save, and capture the resulting card or editor summary showing `1회 납부 · <게시판 이름>` as `admin-once-board.png`.

- [ ] **Step 6: Capture black/gray activity search results**

Open the chosen activity-certification create screen, search `검증`, and capture all four rows as `activity-participant-colors.png`. Inspect pixels and visible styles to confirm:

```text
검증기존전체 / 검증현재행사 -> #212429 black
검증미납 / 검증다른행사     -> #8A919C gray
```

The same screenshot must show the revised two-state guidance and no orange payment label.

- [ ] **Step 7: Write the QA evidence note and stop the isolated stack**

The QA note must include the tested commit, automated command results, the four-state matrix, links to all three images, and any browser/platform caveat. Then stop only this named project:

```powershell
docker compose --env-file .env.qa.example -p aisw_dues_scope_qa -f docker-compose.yml -f docker-compose.qa.yml down
```

Do not pass `-v`; retain the isolated QA volume until the user has reviewed the captures.

- [ ] **Step 8: Commit evidence and present screenshots**

```powershell
git add docs/qa/DUES_PAYMENT_SCOPE_VERIFICATION_2026-09-23.md docs/qa/evidence/dues-payment-scope
git commit -m "test: capture dues scope verification"
```

Return the three screenshots inline to the user with one sentence per result.
