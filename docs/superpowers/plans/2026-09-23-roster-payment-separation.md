# 원우 명부와 현재 학기 원우회비 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 영구 원우 명부와 업로드마다 전체 교체되는 현재 학기 원우회비를 별도 테이블·API·관리자 메뉴로 분리하면서 활동인증의 검정/회색 및 선택 동작을 보존한다.

**Architecture:** 기존 `dues_payers`를 안정적인 ID를 유지한 `student_roster`로 이관하고, 현재 학기 `ALL`/`ONCE`만 저장하는 `dues_payments`를 신설한다. 관리자 명부 API와 납부 API는 분리하고, 활동인증 검색은 명부와 납부를 outer join해 `is_paid_for_board`를 계산한다. 프론트엔드는 대량 조회용 원우 명부 테이블과 납부 스냅샷 관리 화면을 별도 상위 메뉴로 제공한다.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, PostgreSQL/SQLite test runtime, React Native, Expo Router, TanStack Query, TypeScript, Node test runner, pytest

**Spec:** `docs/superpowers/specs/2026-09-23-roster-payment-separation-design.md`

## Global Constraints

- 전체 원우 명부는 학교를 거쳐 간 원우의 영구 기록이며 업로드에서 누락된 행을 삭제하지 않는다.
- 명부 업로드는 헤더 없는 `이름 / 전공 / 학번` 3열 `.xlsx`이며 같은 학번의 이름·전공을 overwrite한다.
- 원우회비 업로드는 파일 전체 검증 후 기존 `ALL`과 `ONCE`를 모두 삭제하고 새 행을 `ALL`로 등록한다.
- `UNPAID`는 `dues_payments` 행이 없는 상태다.
- 원우 한 명은 `ALL` 또는 하나의 활성 활동인증 게시판 `ONCE`만 가질 수 있다.
- 활동인증은 전체 명부를 이름으로 검색하고 검정 `#212429`, 회색 `#8A919C` 모두 선택 가능해야 한다.
- 활동인증 메타데이터 키 `participant_dues_payer_ids`와 기존 명부 ID는 유지한다.
- 관리자 전용 mutation은 백엔드 권한 검사와 공통 PostgreSQL advisory lock을 사용한다.
- API 응답은 성공 `{status, data}`와 오류 `{status, message, code}` 형식을 유지한다.
- 학기별 과거 이력, 명부 삭제, 회원 계정 자동 연결, 복수 `ONCE`는 범위 밖이다.

## Review Focus

- 잘못된 납부 엑셀: 명부 불일치가 하나라도 있으면 기존 납부 행과 감사 로그가 전혀 변경되지 않아야 한다. Task 2와 Task 3의 원자성 테스트가 고정한다.
- 명부 overwrite: 같은 학번의 이름·전공만 바뀌고 안정적인 명부 ID와 기존 납부 FK는 유지되어야 한다. Task 2의 서비스 테스트가 고정한다.
- 삭제된 ONCE 게시판: 연결된 납부 행만 cascade 삭제되어 해당 원우가 `UNPAID`가 되어야 한다. Task 1의 FK 테스트가 고정한다.
- 동시 업로드와 개별 수정: 모든 납부·명부 mutation이 같은 advisory lock을 잡아 마지막 커밋에 따라 결정되어야 한다. Task 2와 Task 3의 lock 테스트가 고정한다.
- 대량 명부 렌더링: 100명 페이지, 이름·학번·전공 검색, 좁은 화면 가로 스크롤이 납부 데이터를 노출하지 않아야 한다. Task 6의 UI 계약 테스트가 고정한다.

---

### Task 1: 분리 스키마와 기존 데이터 이관

**Files:**
- Create: `backend/alembic/versions/0029_roster_dues_separation.py`
- Create: `backend/app/models/student_roster.py`
- Create: `backend/app/models/dues_payment.py`
- Modify: `backend/app/models/__init__.py`
- Delete: `backend/app/models/dues_payer.py`
- Modify: `backend/tests/test_dues_payer_migration.py`

**Interfaces:**
- Produces: `StudentRosterMember(id, student_number, name, major, created_at, updated_at)`.
- Produces: `DuesPayment(id, roster_member_id, scope, once_board_id, created_at, updated_at)`.
- Produces: Alembic revision `0029_roster_dues_separation`, down revision `0028_dues_payment_scope`.
- Consumes: 기존 `dues_payers.id`와 `participant_dues_payer_ids`의 ID 안정성 계약.

- [ ] **Step 1: 기존 ALL/ONCE/UNPAID 데이터를 준비해 분리 마이그레이션이 아직 없어서 실패하는 테스트 작성**

```python
SEPARATION_MIGRATION_PATH = VERSIONS / "0029_roster_dues_separation.py"

def _legacy_engine_with_all_once_unpaid():
    engine = sa.create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(sa.text("PRAGMA foreign_keys=ON"))
        connection.execute(sa.text("CREATE TABLE boards (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL)"))
        roster_migration = _load_migration()
        roster_migration.op = Operations(MigrationContext.configure(connection))
        roster_migration.upgrade()
        scope_migration = _load_payment_scope_migration()
        scope_migration.op = Operations(MigrationContext.configure(connection))
        scope_migration.upgrade()
        connection.execute(sa.text("INSERT INTO boards (id, name) VALUES (12, '스터디 인증')"))
        connection.execute(sa.text(
            "INSERT INTO dues_payers "
            "(id, student_number, name, major, is_full_paid, once_board_id, created_at, updated_at) VALUES "
            "(10, 'A74001', '전체', 'AI', TRUE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),"
            "(11, 'A74002', '행사', 'AI', FALSE, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),"
            "(12, 'A74003', '미납', 'AI', FALSE, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        ))
    return engine

def test_roster_payment_separation_preserves_ids_and_current_scopes() -> None:
    engine = _legacy_engine_with_all_once_unpaid()
    with engine.begin() as connection:
        migration = _load(SEPARATION_MIGRATION_PATH)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert connection.execute(sa.text(
            "SELECT id, student_number FROM student_roster ORDER BY id"
        )).all() == [(10, "A74001"), (11, "A74002"), (12, "A74003")]
        assert connection.execute(sa.text(
            "SELECT roster_member_id, scope, once_board_id FROM dues_payments ORDER BY roster_member_id"
        )).all() == [(10, "ALL", None), (11, "ONCE", 12)]
```

- [ ] **Step 2: 마이그레이션 테스트가 파일 부재로 실패하는지 확인**

Run: `cd backend; python -m pytest tests/test_dues_payer_migration.py -q`

Expected: FAIL because `0029_roster_dues_separation.py` and the new models do not exist.

- [ ] **Step 3: 새 모델과 분리 마이그레이션 구현**

```python
class StudentRosterMember(Base):
    __tablename__ = "student_roster"
    __table_args__ = (
        UniqueConstraint("student_number", name="uq_student_roster_student_number"),
        Index("ix_student_roster_name", "name"),
        Index("ix_student_roster_major", "major"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    student_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    major: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

class DuesPayment(Base):
    __tablename__ = "dues_payments"
    __table_args__ = (
        UniqueConstraint("roster_member_id", name="uq_dues_payments_roster_member_id"),
        CheckConstraint(
            "(scope = 'ALL' AND once_board_id IS NULL) OR "
            "(scope = 'ONCE' AND once_board_id IS NOT NULL)",
            name="ck_dues_payments_scope",
        ),
        Index("ix_dues_payments_once_board_id", "once_board_id"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    roster_member_id: Mapped[int] = mapped_column(
        ForeignKey("student_roster.id", ondelete="CASCADE"), nullable=False
    )
    scope: Mapped[str] = mapped_column(String(10), nullable=False)
    once_board_id: Mapped[int | None] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"), nullable=True
    )
```

The upgrade must create both tables, copy roster IDs and payment scopes, then drop `dues_payers`. The downgrade must recreate the 0028-shaped `dues_payers`, left join payments into `is_full_paid`/`once_board_id`, then drop the split tables.

- [ ] **Step 4: 왕복과 FK 경계 테스트 추가**

```python
def test_separation_downgrade_restores_single_table_counts() -> None:
    engine = _legacy_engine_with_all_once_unpaid()
    with engine.begin() as connection:
        migration = _load(SEPARATION_MIGRATION_PATH)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        migration.downgrade()
        assert connection.execute(sa.text("SELECT COUNT(*) FROM dues_payers")).scalar_one() == 3
        assert connection.execute(sa.text(
            "SELECT COUNT(*) FROM dues_payers WHERE is_full_paid = TRUE"
        )).scalar_one() == 1
        assert connection.execute(sa.text(
            "SELECT COUNT(*) FROM dues_payers WHERE once_board_id IS NOT NULL"
        )).scalar_one() == 1
        assert connection.execute(sa.text(
            "SELECT COUNT(*) FROM dues_payers WHERE is_full_paid = FALSE AND once_board_id IS NULL"
        )).scalar_one() == 1

def test_deleting_once_board_deletes_only_matching_payment() -> None:
    engine = _legacy_engine_with_all_once_unpaid()
    with engine.begin() as connection:
        migration = _load(SEPARATION_MIGRATION_PATH)
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        connection.execute(sa.text("DELETE FROM boards WHERE id = 12"))
        assert connection.execute(sa.text(
            "SELECT COUNT(*) FROM dues_payments WHERE roster_member_id = 11"
        )).scalar_one() == 0
        assert connection.execute(sa.text(
            "SELECT COUNT(*) FROM student_roster WHERE id = 11"
        )).scalar_one() == 1
```

- [ ] **Step 5: 모델·마이그레이션 테스트 실행**

Run: `cd backend; python -m pytest tests/test_dues_payer_migration.py -q`

Expected: PASS.

- [ ] **Step 6: 스키마 작업 커밋**

```bash
git add backend/alembic/versions/0029_roster_dues_separation.py backend/app/models backend/tests/test_dues_payer_migration.py
git commit -m "feat: split student roster and dues payments"
```

### Task 2: 명부 upsert와 납부 전체 교체 서비스

**Files:**
- Create: `backend/app/student_roster_service.py`
- Create: `backend/app/dues_payment_service.py`
- Delete: `backend/app/dues_payer_service.py`
- Modify: `backend/tests/test_dues_payers.py`
- Modify: `backend/tests/test_dues_payer_lock.py`

**Interfaces:**
- Consumes: `StudentRosterMember`, `DuesPayment`, `DuesPayerRow` from Task 1/current parser.
- Produces: `import_roster(db, rows) -> {created, updated, unchanged, total_rows}`.
- Produces: `replace_payment_snapshot(db, rows) -> {cleared, registered, total_rows}`.
- Produces: `set_payment_scope(db, member, scope, once_board_id) -> tuple[DuesPayment | None, Board | None]`.
- Produces: `payment_scope(payment: DuesPayment | None) -> Literal["ALL", "ONCE", "UNPAID"]`.
- Produces: `lock_dues_mutation(db)` using advisory-lock key `aisw-dues-payer-mutations`.

- [ ] **Step 1: 명부 overwrite가 안정적인 ID와 기존 납부를 보존하는 실패 테스트 작성**

```python
def test_roster_import_overwrites_identity_without_touching_payment(api) -> None:
    with api.session() as db:
        member = StudentRosterMember(name="이전이름", major="이전전공", student_number="A74001")
        db.add(member)
        db.flush()
        db.add(DuesPayment(roster_member_id=member.id, scope="ONCE", once_board_id=1))
        stable_id = member.id
        db.commit()

    response = _import_roster(api, [("새이름", "새전공", "A74001")])

    assert response.status_code == 200
    assert response.json()["data"] == {"created": 0, "updated": 1, "unchanged": 0, "total_rows": 1}
    with api.session() as db:
        member = db.get(StudentRosterMember, stable_id)
        payment = db.scalar(select(DuesPayment).where(DuesPayment.roster_member_id == stable_id))
        assert (member.name, member.major) == ("새이름", "새전공")
        assert (payment.scope, payment.once_board_id) == ("ONCE", 1)
```

- [ ] **Step 2: 납부 업로드가 ALL과 ONCE 전체를 교체하는 실패 테스트 작성**

```python
def test_payment_import_replaces_every_existing_scope(api) -> None:
    with api.session() as db:
        first = StudentRosterMember(name="첫번째", major="AI", student_number="A74001")
        second = StudentRosterMember(name="두번째", major="AI", student_number="A74002")
        third = StudentRosterMember(name="세번째", major="AI", student_number="A74003")
        db.add_all([first, second, third])
        db.flush()
        db.add_all([
            DuesPayment(roster_member_id=first.id, scope="ALL"),
            DuesPayment(roster_member_id=second.id, scope="ONCE", once_board_id=1),
        ])
        third_id = third.id
        db.commit()
    response = _import_payments(api, [("세번째", "AI", "A74003")])
    assert response.status_code == 200
    assert response.json()["data"] == {"cleared": 2, "registered": 1, "total_rows": 1}
    with api.session() as db:
        payments = db.scalars(select(DuesPayment)).all()
        assert len(payments) == 1
        assert (payments[0].roster_member_id, payments[0].scope) == (third_id, "ALL")
```

- [ ] **Step 3: 대상 서비스 함수가 없어 실패하는지 확인**

Run: `cd backend; python -m pytest tests/test_dues_payers.py tests/test_dues_payer_lock.py -q`

Expected: FAIL on missing split models/service behavior.

- [ ] **Step 4: 명부 upsert와 납부 스냅샷 서비스 구현**

```python
def import_roster(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    existing = {
        item.student_number: item
        for item in db.scalars(
            select(StudentRosterMember)
            .where(StudentRosterMember.student_number.in_([row.student_number for row in rows]))
            .with_for_update()
        ).all()
    }
    created = updated = unchanged = 0
    for row in rows:
        item = existing.get(row.student_number)
        if item is None:
            db.add(StudentRosterMember(name=row.name, major=row.major, student_number=row.student_number))
            created += 1
        elif (item.name, item.major) == (row.name, row.major):
            unchanged += 1
        else:
            item.name, item.major = row.name, row.major
            updated += 1
    return {"created": created, "updated": updated, "unchanged": unchanged, "total_rows": len(rows)}

def replace_payment_snapshot(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    members = db.scalars(select(StudentRosterMember).with_for_update()).all()
    by_number = {member.student_number: member for member in members}
    for row in rows:
        member = by_number.get(row.student_number)
        if member is None or member.name != row.name:
            raise AppException(
                status_code=422,
                message=f"Row {row.row_number} does not exactly match the registered roster.",
                code="DUES_IMPORT_ROSTER_MISMATCH",
            )
    cleared = db.scalar(select(func.count(DuesPayment.id))) or 0
    db.execute(delete(DuesPayment))
    db.add_all(DuesPayment(roster_member_id=by_number[row.student_number].id, scope="ALL") for row in rows)
    return {"cleared": cleared, "registered": len(rows), "total_rows": len(rows)}
```

- [ ] **Step 5: 잘못된 파일 검증이 삭제보다 먼저 실행되는 원자성 테스트 추가**

```python
def test_invalid_payment_snapshot_does_not_clear_existing_payments(api) -> None:
    rejected = _import_payments(api, [("다른이름", "AI", "A74001")])
    assert rejected.status_code == 422
    with api.session() as db:
        assert db.scalar(select(func.count(DuesPayment.id))) == 2
        assert db.scalar(select(OperationalAuditLog).where(
            OperationalAuditLog.action == "dues_payment.import"
        )) is None
```

- [ ] **Step 6: 공통 advisory lock 테스트를 새 서비스명으로 갱신하고 서비스 테스트 실행**

Run: `cd backend; python -m pytest tests/test_dues_payers.py tests/test_dues_payer_lock.py -q`

Expected: PASS.

- [ ] **Step 7: 서비스 작업 커밋**

```bash
git add backend/app/student_roster_service.py backend/app/dues_payment_service.py backend/tests/test_dues_payers.py backend/tests/test_dues_payer_lock.py backend/app/dues_payer_service.py
git commit -m "feat: replace current-term dues snapshot atomically"
```

### Task 3: 관리자 명부·납부 API 분리

**Files:**
- Modify: `backend/app/routers/dues_payers.py`
- Modify: `backend/app/schemas/dues_payer.py`
- Modify: `backend/tests/test_dues_payers.py`

**Interfaces:**
- Consumes: Task 2 service functions.
- Produces: `GET /api/dues-payers/admin/roster` identity-only pagination.
- Produces: `POST /api/dues-payers/admin/roster/import` roster upsert.
- Produces: `GET /api/dues-payers/admin/payments` roster/payment joined pagination.
- Produces: `POST /api/dues-payers/admin/payments/import` full replacement.
- Produces: `PUT /api/dues-payers/admin/payments/{roster_member_id}` scope mutation.

- [ ] **Step 1: 새 관리자 계약과 제거될 이전 경로의 실패 테스트 작성**

```python
def test_admin_roster_searches_name_student_number_and_major_without_payment_fields(api) -> None:
    response = api.client.get(
        "/api/dues-payers/admin/roster",
        headers=api.headers["admin"],
        params={"q": "데이터사이언스", "page": 1, "size": 100},
    )
    assert response.status_code == 200
    assert set(response.json()["data"][0]) == {"id", "name", "major", "student_number"}

def test_removed_combined_admin_routes_return_404(api) -> None:
    assert api.client.get("/api/dues-payers/admin/payers", headers=api.headers["admin"]).status_code == 404
    assert api.client.post("/api/dues-payers/admin/import", headers=api.headers["admin"]).status_code == 404
    assert api.client.post("/api/dues-payers/admin/payments/reset", headers=api.headers["admin"]).status_code == 404
```

- [ ] **Step 2: 새 경로가 없어 실패하는지 확인**

Run: `cd backend; python -m pytest tests/test_dues_payers.py -q`

Expected: FAIL with 404 for new routes and non-404 for old routes.

- [ ] **Step 3: 납부 요청 스키마를 신원과 분리**

```python
class DuesPaymentWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    payment_scope: Literal["ALL", "ONCE", "UNPAID"]
    once_board_id: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def validate_scope(self):
        if self.payment_scope == "ONCE" and self.once_board_id is None:
            raise ValueError("ONCE requires once_board_id")
        if self.payment_scope != "ONCE" and self.once_board_id is not None:
            raise ValueError("once_board_id is allowed only for ONCE")
        return self
```

- [ ] **Step 4: identity-only roster payload와 joined payment payload 구현**

```python
def _roster_payload(member: StudentRosterMember) -> dict:
    return {"id": member.id, "name": member.name, "major": member.major, "student_number": member.student_number}

def _payment_payload(member, payment, board_name) -> dict:
    return {
        **_roster_payload(member),
        "payment_scope": payment_scope(payment),
        "once_board_id": payment.once_board_id if payment else None,
        "once_board_name": board_name,
    }
```

Roster `q` must use `or_(name.ilike, student_number.ilike, major.ilike)`. Payment listing uses the same search so an unpaid roster member can be selected for individual payment registration.

- [ ] **Step 5: 개별 ALL/ONCE/UNPAID와 관리자 권한 테스트 추가**

```python
def test_admin_updates_current_payment_without_editing_identity(api) -> None:
    once = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        headers=api.headers["admin"],
        json={"payment_scope": "ONCE", "once_board_id": board_id},
    )
    assert once.json()["data"]["payment_scope"] == "ONCE"
    unpaid = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        headers=api.headers["admin"],
        json={"payment_scope": "UNPAID", "once_board_id": None},
    )
    assert unpaid.json()["data"]["payment_scope"] == "UNPAID"
    with api.session() as db:
        assert db.scalar(select(DuesPayment).where(DuesPayment.roster_member_id == member_id)) is None
```

- [ ] **Step 6: 동시 mutation 경로가 모두 `require_dues_mutation_admin`을 사용하는 source/behavior 테스트 유지**

Run: `cd backend; python -m pytest tests/test_dues_payers.py tests/test_dues_payer_lock.py -q`

Expected: PASS, including member 403 and missing roster/invalid board normalized errors.

- [ ] **Step 7: 관리자 API 작업 커밋**

```bash
git add backend/app/routers/dues_payers.py backend/app/schemas/dues_payer.py backend/tests/test_dues_payers.py backend/tests/test_dues_payer_lock.py
git commit -m "feat: separate roster and dues admin APIs"
```

### Task 4: 활동인증 검색과 참가자 저장을 새 명부 모델로 연결

**Files:**
- Modify: `backend/app/routers/dues_payers.py`
- Modify: `backend/app/routers/posts.py`
- Modify: `backend/tests/test_activity_certification_dues_payers.py`
- Modify: `backend/tests/test_activity_certification_edit.py`
- Modify: `backend/tests/test_club_activity_sources.py`

**Interfaces:**
- Consumes: `StudentRosterMember.id`, optional joined `DuesPayment`.
- Preserves: `GET /api/dues-payers/search?q&board_id&size` response shape.
- Preserves: post metadata `participant_dues_payer_ids` and server-generated participant label.

- [ ] **Step 1: ALL, matching ONCE, different ONCE, absent payment의 검색 색상 테스트를 split model fixture로 변경**

```python
def test_search_derives_board_payment_from_optional_payment_row(api) -> None:
    response = api.client.get(
        "/api/dues-payers/search",
        headers=api.headers["member"],
        params={"q": "검증", "board_id": study_board_id},
    )
    states = {item["name"]: item["is_paid_for_board"] for item in response.json()["data"]}
    assert states == {
        "검증전체": True,
        "검증현재행사": True,
        "검증다른행사": False,
        "검증미납": False,
    }
```

- [ ] **Step 2: 기존 DuesPayer 의존 때문에 실패하는지 확인**

Run: `cd backend; python -m pytest tests/test_activity_certification_dues_payers.py tests/test_activity_certification_edit.py tests/test_club_activity_sources.py -q`

Expected: FAIL on removed model/import or missing payment join.

- [ ] **Step 3: 검색 쿼리를 roster/payment outer join으로 전환**

```python
rows = db.execute(
    select(StudentRosterMember, DuesPayment)
    .outerjoin(DuesPayment, DuesPayment.roster_member_id == StudentRosterMember.id)
    .where(StudentRosterMember.name.ilike(keyword))
    .order_by(StudentRosterMember.name, StudentRosterMember.student_number, StudentRosterMember.id)
    .limit(size)
).all()

"is_paid_for_board": bool(
    payment and (payment.scope == "ALL" or payment.once_board_id == board.id)
)
```

- [ ] **Step 4: 게시글 참가자 검증·스냅샷 생성을 `StudentRosterMember`로 전환**

`_canonical_activity_metadata()` must load every requested roster ID, preserve the requested order, reject missing/duplicate IDs, and never gate storage on a payment row.

- [ ] **Step 5: 미납과 다른-board ONCE 참가자도 게시글에 저장되는 회귀 테스트 실행**

Run: `cd backend; python -m pytest tests/test_activity_certification_dues_payers.py tests/test_activity_certification_edit.py tests/test_club_activity_sources.py -q`

Expected: PASS.

- [ ] **Step 6: 활동인증 연결 작업 커밋**

```bash
git add backend/app/routers/dues_payers.py backend/app/routers/posts.py backend/tests/test_activity_certification_dues_payers.py backend/tests/test_activity_certification_edit.py backend/tests/test_club_activity_sources.py
git commit -m "refactor: resolve activity participants from student roster"
```

### Task 5: 프론트엔드 API와 타입 계약 분리

**Files:**
- Modify: `frontend/types/index.ts`
- Modify: `frontend/services/api.ts`
- Modify: `frontend/utils/duesPayers.ts`
- Modify: `frontend/tests/duesPayers.test.ts`

**Interfaces:**
- Produces: `AdminRosterItem` identity-only type.
- Produces: `AdminDuesPaymentItem` with derived scope.
- Produces: `DuesPaymentWritePayload = {payment_scope, once_board_id}`.
- Produces: `duesPayerApi.getAdminRoster`, `getAdminPayments`, `importRosterWorkbook`, `importPaymentWorkbook`, `updatePayment`.

- [ ] **Step 1: 새로운 import summary와 identity-free payment payload 테스트 작성**

```typescript
test("전체 납부 업로드 결과는 기존 삭제와 신규 등록 건수를 안내한다", () => {
  assert.equal(
    formatPaymentImportSummary({ cleared: 4, registered: 3, total_rows: 3 }),
    "기존 납부 4명 초기화 · 현재 학기 전체 납부 3명 등록",
  );
});

test("수동 초기화 확인 상수는 더 이상 노출하지 않는다", () => {
  assert.equal("DUES_RESET_CONFIRMATION" in duesUtils, false);
});
```

- [ ] **Step 2: 현재 타입/유틸 때문에 테스트와 typecheck가 실패하는지 확인**

Run: `cd frontend; npx tsx --test tests/duesPayers.test.ts; npm run typecheck`

Expected: FAIL on old reset fields and old import result shape.

- [ ] **Step 3: 프론트엔드 타입을 추가하되 이전 화면용 타입은 Task 7까지 임시 유지**

```typescript
export type AdminRosterItem = {
  id: number;
  name: string;
  major: string;
  student_number: string;
};

export type AdminDuesPaymentItem = AdminRosterItem & {
  payment_scope: DuesPaymentScope;
  once_board_id: number | null;
  once_board_name: string | null;
};

export type DuesPaymentWritePayload = {
  payment_scope: DuesPaymentScope;
  once_board_id: number | null;
};

export type DuesPaymentImportResult = {
  cleared: number;
  registered: number;
  total_rows: number;
};
```

Keep `AdminDuesPayerItem`, `DuesPayerWritePayload`, and `DuesPaymentResetResult` unchanged in this task so the old combined component continues to typecheck. Task 7 deletes them together with that component.

- [ ] **Step 4: 새 관리자 API 메서드를 추가하고 이전 메서드는 Task 7까지 임시 유지**

```typescript
getAdminRoster: (params) => api.get("/dues-payers/admin/roster", { params }),
getAdminPayments: (params) => api.get("/dues-payers/admin/payments", { params }),
importPaymentWorkbook: (file) => postDuesWorkbook("/dues-payers/admin/payments/import", file),
updatePayment: (rosterMemberId, payload) => api.put(
  `/dues-payers/admin/payments/${rosterMemberId}`,
  payload,
),
```

Keep `getAdminPayers`, `createPayer`, `updatePayer`, and `resetPayments` only as temporary compile compatibility for the old screen. Do not call them from either new screen.

- [ ] **Step 5: 유틸 테스트와 typecheck 실행**

Run: `cd frontend; npx tsx --test tests/duesPayers.test.ts; npm run typecheck`

Expected: PASS with typecheck exit 0.

- [ ] **Step 6: 프론트엔드 계약 작업 커밋**

```bash
git add frontend/types/index.ts frontend/services/api.ts frontend/utils/duesPayers.ts frontend/tests/duesPayers.test.ts
git commit -m "refactor: split roster and dues client contracts"
```

### Task 6: 대량 원우 명부 관리자 화면

**Files:**
- Create: `frontend/components/admin/DuesRosterSection.tsx`
- Create: `frontend/components/admin/DuesAdminPrimitives.tsx`
- Modify: `frontend/app/admin/index.tsx`
- Modify: `frontend/tests/duesPayerAdminUi.test.ts`
- Modify: `frontend/tests/adminBoardManagementUi.test.ts`

**Interfaces:**
- Consumes: `duesPayerApi.getAdminRoster`, `importRosterWorkbook`, `AdminRosterItem`.
- Produces: top-level admin section key `studentRoster` and label `원우 명부`.
- Produces: 100-row identity-only table with server-side `q` search.

- [ ] **Step 1: 명부 화면에 납부 용어가 없고 세 열·검색·100행을 요구하는 실패 테스트 작성**

```typescript
const rosterSource = readFileSync("components/admin/DuesRosterSection.tsx", "utf8");

test("원우 명부는 신원 3열 대량 테이블만 제공한다", () => {
  assert.match(rosterSource, /전체 원우 명부 업로드/);
  assert.match(rosterSource, /이름/);
  assert.match(rosterSource, /학번/);
  assert.match(rosterSource, /전공/);
  assert.match(rosterSource, /size: 100/);
  assert.match(rosterSource, /horizontal/);
  assert.doesNotMatch(rosterSource, /ALL|ONCE|UNPAID|전체 납부|특정 행사|미납|수정/);
});
```

- [ ] **Step 2: 새 컴포넌트 부재로 테스트가 실패하는지 확인**

Run: `cd frontend; npx tsx --test tests/duesPayerAdminUi.test.ts tests/adminBoardManagementUi.test.ts`

Expected: FAIL because `DuesRosterSection.tsx` does not exist.

- [ ] **Step 3: 공용 버튼/색상 primitive와 명부 화면 구현**

`DuesRosterSection` must:

- call `getAdminRoster({q, page, size: 100})`;
- reset page to 1 on search submission and successful upload;
- invalidate `['admin-dues-roster']` and `['admin-dues-payments']` after overwrite;
- render a horizontal `ScrollView` containing a header and fixed-width `이름 | 학번 | 전공` rows;
- render loading, error, empty, total count, previous/next states;
- never import `formatDuesScope` or payment types.

- [ ] **Step 4: 관리자 메뉴에 `studentRoster`를 추가하되 기존 원우회비 화면은 아직 유지**

```typescript
type AdminSection =
  | "dashboard"
  | "banners"
  | "boardManagement"
  | "accounts"
  | "studentRoster"
  | "duesPayers"
  | "reports"
  | "registration";

{ key: "studentRoster", label: "원우 명부", icon: "people-circle-outline" }

{section === "studentRoster" ? <DuesRosterSection /> : null}
```

- [ ] **Step 5: 명부 UI 테스트와 typecheck 실행**

Run: `cd frontend; npx tsx --test tests/duesPayerAdminUi.test.ts tests/adminBoardManagementUi.test.ts; npm run typecheck`

Expected: roster tests PASS and typecheck exit 0.

- [ ] **Step 6: 명부 화면 작업 커밋**

```bash
git add frontend/components/admin/DuesRosterSection.tsx frontend/components/admin/DuesAdminPrimitives.tsx frontend/app/admin/index.tsx frontend/tests/duesPayerAdminUi.test.ts frontend/tests/adminBoardManagementUi.test.ts
git commit -m "feat: add dense student roster admin table"
```

### Task 7: 현재 학기 원우회비 관리자 화면

**Files:**
- Create: `frontend/components/admin/DuesPaymentSection.tsx`
- Create: `frontend/components/admin/DuesPaymentEditor.tsx`
- Delete: `frontend/components/admin/DuesPayerSection.tsx`
- Delete: `frontend/components/admin/DuesPayerEditor.tsx`
- Modify: `frontend/app/admin/index.tsx`
- Modify: `frontend/types/index.ts`
- Modify: `frontend/services/api.ts`
- Modify: `frontend/tests/duesPayerAdminUi.test.ts`
- Modify: `frontend/tests/adminBoardManagementUi.test.ts`

**Interfaces:**
- Consumes: `getAdminPayments`, `importPaymentWorkbook`, `updatePayment`, active activity boards.
- Produces: top-level admin section key `duesPayments` and label `원우회비`.
- Produces: read-only identity plus editable `ALL`/`ONCE`/`UNPAID` modal.

- [ ] **Step 1: 전체 교체 경고, 초기화 UI 제거, 신원 읽기 전용을 요구하는 실패 테스트 작성**

```typescript
test("원우회비 화면은 업로드 전체 교체와 개별 납부 수정만 제공한다", () => {
  assert.match(paymentSource, /현재 학기 전체 납부자 업로드/);
  assert.match(paymentSource, /기존 전체 납부와 특정 행사 1회 납부가 모두 초기화/);
  assert.match(paymentSource, /updatePayment/);
  assert.doesNotMatch(paymentSource, /납부자 초기화 시작|resetPayments|개별 등록/);
});

test("납부 편집기의 신원 필드는 입력 컴포넌트가 아니다", () => {
  assert.match(editorSource, /item\.name/);
  assert.match(editorSource, /item\.student_number/);
  assert.match(editorSource, /item\.major/);
  assert.doesNotMatch(editorSource, /setName|setMajor|setStudentNumber/);
});
```

- [ ] **Step 2: 새 컴포넌트 부재로 테스트가 실패하는지 확인**

Run: `cd frontend; npx tsx --test tests/duesPayerAdminUi.test.ts`

Expected: FAIL.

- [ ] **Step 3: 현재 학기 원우회비 화면 구현**

The upload action must show a confirmation before opening the picker:

```typescript
Alert.alert(
  "현재 학기 납부자 교체",
  "업로드하면 기존 전체 납부와 특정 행사 1회 납부가 모두 초기화됩니다.",
  [
    { text: "취소", style: "cancel" },
    { text: "엑셀 선택", style: "destructive", onPress: () => void importPaymentWorkbook() },
  ],
);
```

The list queries all roster rows through `getAdminPayments({q, page, size: 100})`, displays the derived scope, and opens `DuesPaymentEditor` for each row.

- [ ] **Step 4: 신원 읽기 전용 납부 편집기 구현**

```typescript
const payload: DuesPaymentWritePayload = {
  payment_scope: scope,
  once_board_id: scope === "ONCE" ? selectedBoardId : null,
};
```

The save button is disabled until an active board is selected for `ONCE`. `UNPAID` remains a selectable UI state even though the backend deletes the payment row.

- [ ] **Step 5: 관리자 메뉴를 `duesPayers`에서 `duesPayments`로 전환하고 이전 컴포넌트·타입·API 메서드 제거**

```typescript
{ key: "duesPayments", label: "원우회비", icon: "receipt-outline" }

{section === "duesPayments" ? <DuesPaymentSection /> : null}
```

Delete `AdminDuesPayerItem`, `DuesPayerWritePayload`, `DuesPaymentResetResult`, `getAdminPayers`, `createPayer`, `updatePayer`, and `resetPayments` after no source file imports them.

- [ ] **Step 6: 프론트엔드 전체 테스트·typecheck·lint 실행**

Run: `cd frontend; npm test; npm run typecheck; npm run lint`

Expected: all tests PASS, typecheck exit 0, lint has zero errors. Pre-existing warnings may remain and must be listed without modifying unrelated files.

- [ ] **Step 7: 납부 화면 작업 커밋**

```bash
git add frontend/components/admin frontend/app/admin/index.tsx frontend/tests/duesPayerAdminUi.test.ts frontend/tests/adminBoardManagementUi.test.ts
git commit -m "feat: separate current-term dues admin workflow"
```

### Task 8: 계약 문서, 전체 회귀, 실제 화면 증거

**Files:**
- Modify: `PLAN.md`
- Modify: `CODEX.md`
- Modify: `docs/phase2/API_CONTRACT.md`
- Modify: `docs/phase2/DB_SCHEMA_DECISIONS.md`
- Modify: `docs/phase2/AUTH_PERMISSION_SPEC.md`
- Modify: `docs/phase2/FRONTEND_ROUTE_SPEC.md`
- Create: `docs/qa/ROSTER_DUES_SEPARATION_2026-09-23.md`
- Create: `docs/qa/evidence/roster-dues-separation/admin-roster-table.png`
- Create: `docs/qa/evidence/roster-dues-separation/admin-dues-payments.png`
- Create: `docs/qa/evidence/roster-dues-separation/activity-participant-colors.png`

**Interfaces:**
- Consumes: all completed tasks and spec.
- Produces: final API/DB/auth/frontend contract and QA evidence.

- [ ] **Step 1: Phase 2 계약과 PLAN/CODEX를 최종 동작으로 갱신**

Document exactly:

- permanent `student_roster` and replaceable `dues_payments`;
- roster overwrite by student number without deletion;
- payment import clears both `ALL` and `ONCE` only after validation;
- no standalone payment reset endpoint;
- identity-only roster admin and payment-only edit admin;
- public search exposes only board-specific boolean and allows every roster row.

- [ ] **Step 2: 백엔드 전체 회귀 실행**

Run: `cd backend; python -m pytest -q`

Expected: 0 failures. Record pass/skip counts in the QA document.

- [ ] **Step 3: 프론트엔드 전체 회귀 실행**

Run: `cd frontend; npm test; npm run typecheck; npm run lint`

Expected: 0 test failures, typecheck exit 0, lint zero errors.

- [ ] **Step 4: Alembic과 import 검증 실행**

Run: `cd backend; python -m compileall app alembic; python -c "from app.main import app; print(len(app.routes))"`

Expected: compile and import exit 0. Run the repository's available isolated PostgreSQL migration rehearsal when Docker/PostgreSQL is available; otherwise record the exact unavailable prerequisite and keep SQLite migration coverage as the verified result.

- [ ] **Step 5: 로컬 서버에서 관리자 두 화면과 활동인증을 실제 렌더링**

Verify:

1. `원우 명부` shows a 100-row-capable `이름 | 학번 | 전공` table and major search.
2. Uploading a changed identity overwrites the row without changing its current payment.
3. `원우회비` warns before replacement and shows every roster member with derived status.
4. A payment upload removes prior manual `ONCE` rows and registers only the new `ALL` list.
5. Individual `ONCE` applies black only to the selected board; other boards and unpaid remain gray and selectable.

Save the three named screenshots and write the exact test data/board IDs in the QA document without including raw production PII.

- [ ] **Step 6: diff와 문서 일관성 검사**

Run: `git diff --check; git status --short`

Expected: no whitespace errors and only intended files changed.

- [ ] **Step 7: 최종 문서·증거 커밋**

```bash
git add PLAN.md CODEX.md docs/phase2 docs/qa
git commit -m "docs: verify roster and dues separation"
```

- [ ] **Step 8: 완료 전 독립 리뷰와 최종 검증**

Use `superpowers:requesting-code-review` for a whole-branch review against the spec. Resolve every Critical/Important finding, rerun the affected focused tests, then rerun the complete backend/frontend verification commands before presenting merge options through `superpowers:finishing-a-development-branch`.
