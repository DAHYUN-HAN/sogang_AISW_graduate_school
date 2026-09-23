from io import BytesIO

import pytest
from openpyxl import Workbook
from sqlalchemy import func, select

from app.config import settings
from app.dues_payer_import import DuesPayerRow
from app.dues_payment_service import replace_payment_snapshot
from app.errors import AppException
from app.models.audit import OperationalAuditLog
from app.models.board import Board
from app.models.dues_payment import DuesPayment
from app.models.student_roster import StudentRosterMember
from app.routers import dues_payers as dues_payers_router
from app.student_roster_service import import_roster


XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _workbook_bytes(rows: list[tuple[object, ...]]) -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    return output.getvalue()


def _import_roster(api, rows: list[tuple[object, ...]], *, actor: str = "admin"):
    return api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("roster.xlsx", _workbook_bytes(rows), XLSX_MIME)},
        headers=api.headers[actor],
    )


def _import_payments(api, rows: list[tuple[object, ...]], *, actor: str = "admin"):
    return api.client.post(
        "/api/dues-payers/admin/payments/import",
        files={"file": ("payments.xlsx", _workbook_bytes(rows), XLSX_MIME)},
        headers=api.headers[actor],
    )


def _parsed_rows(rows: list[tuple[str, str, str]]) -> list[DuesPayerRow]:
    return [
        DuesPayerRow(
            row_number=index,
            name=name,
            major=major,
            student_number=student_number,
        )
        for index, (name, major, student_number) in enumerate(rows, start=1)
    ]


def _activity_board(
    api,
    *,
    name: str = "스터디 인증",
    slug: str = "study-dues",
    is_active: bool = True,
) -> int:
    with api.session() as db:
        board = Board(
            name=name,
            slug=slug,
            category="participation",
            board_type="activity_certification",
            read_permission="user",
            write_permission="user",
            is_active=is_active,
        )
        db.add(board)
        db.commit()
        db.refresh(board)
        return board.id


def test_roster_service_overwrites_identity_without_touching_payment(api) -> None:
    board_id = _activity_board(api, slug="roster-overwrite-board")
    with api.session() as db:
        member = StudentRosterMember(
            name="이전이름",
            major="이전전공",
            student_number="A74001",
        )
        db.add(member)
        db.flush()
        db.add(
            DuesPayment(
                roster_member_id=member.id,
                scope="ONCE",
                once_board_id=board_id,
            )
        )
        stable_id = member.id
        db.commit()

    with api.session() as db:
        result = import_roster(db, _parsed_rows([("새이름", "새전공", "A74001")]))
        db.commit()

    assert result == {"created": 0, "updated": 1, "unchanged": 0, "total_rows": 1}
    with api.session() as db:
        member = db.get(StudentRosterMember, stable_id)
        payment = db.scalar(
            select(DuesPayment).where(DuesPayment.roster_member_id == stable_id)
        )
        assert member is not None
        assert payment is not None
        assert (member.name, member.major) == ("새이름", "새전공")
        assert (payment.scope, payment.once_board_id) == ("ONCE", board_id)


def test_payment_service_replaces_every_existing_scope(api) -> None:
    board_id = _activity_board(api, slug="snapshot-replacement-board")
    with api.session() as db:
        first = StudentRosterMember(name="첫번째", major="AI", student_number="A74001")
        second = StudentRosterMember(name="두번째", major="AI", student_number="A74002")
        third = StudentRosterMember(name="세번째", major="AI", student_number="A74003")
        db.add_all([first, second, third])
        db.flush()
        db.add_all(
            [
                DuesPayment(roster_member_id=first.id, scope="ALL"),
                DuesPayment(
                    roster_member_id=second.id,
                    scope="ONCE",
                    once_board_id=board_id,
                ),
            ]
        )
        third_id = third.id
        db.commit()

    with api.session() as db:
        result = replace_payment_snapshot(
            db,
            _parsed_rows([("세번째", "무시되는전공", "A74003")]),
        )
        db.commit()

    assert result == {"cleared": 2, "registered": 1, "total_rows": 1}
    with api.session() as db:
        payments = db.scalars(select(DuesPayment)).all()
        assert len(payments) == 1
        assert (payments[0].roster_member_id, payments[0].scope) == (third_id, "ALL")


def test_invalid_payment_snapshot_does_not_clear_existing_payments(api) -> None:
    with api.session() as db:
        member = StudentRosterMember(name="정확한이름", major="AI", student_number="A74001")
        db.add(member)
        db.flush()
        db.add(DuesPayment(roster_member_id=member.id, scope="ALL"))
        db.commit()

    with api.session() as db:
        with pytest.raises(AppException) as error:
            replace_payment_snapshot(
                db,
                _parsed_rows([("다른이름", "AI", "A74001")]),
            )
        assert error.value.code == "DUES_IMPORT_ROSTER_MISMATCH"
        assert db.scalar(select(func.count(DuesPayment.id))) == 1


def test_admin_roster_import_overwrites_and_searches_identity_only(api) -> None:
    first = _import_roster(
        api,
        [
            ("김민준", "데이터사이언스", "A74003"),
            ("이현화", "정보처리", "A34011"),
        ],
    )
    second = _import_roster(
        api,
        [
            ("김민준수정", "인공지능", "a74003"),
            ("홍길동", "보안 및 블록체인", "A74099"),
        ],
    )

    assert first.status_code == 200
    assert first.json()["data"] == {"created": 2, "updated": 0, "unchanged": 0, "total_rows": 2}
    assert second.status_code == 200
    assert second.json()["data"] == {"created": 1, "updated": 1, "unchanged": 0, "total_rows": 2}

    for query, expected_number in [
        ("김민준수정", "A74003"),
        ("A34011", "A34011"),
        ("보안 및 블록체인", "A74099"),
    ]:
        response = api.client.get(
            "/api/dues-payers/admin/roster",
            params={"q": query, "page": 1, "size": 100},
            headers=api.headers["admin"],
        )
        assert response.status_code == 200
        assert response.json()["data"][0]["student_number"] == expected_number
        assert set(response.json()["data"][0]) == {"id", "name", "major", "student_number"}


@pytest.mark.parametrize(
    ("rows", "expected_code", "expected_row"),
    [
        ([("홍길동", None, "A74001")], "DUES_IMPORT_EMPTY_VALUE", "1"),
        ([("홍길동", "인공지능", "A7400X")], "DUES_IMPORT_INVALID_STUDENT_NUMBER", "1"),
        (
            [("홍길동", "인공지능", "A74001"), ("김서강", "보안", "a74001")],
            "DUES_IMPORT_DUPLICATE_STUDENT_NUMBER",
            "2",
        ),
    ],
)
def test_invalid_roster_rows_reject_entire_workbook(api, rows, expected_code, expected_row) -> None:
    response = _import_roster(api, rows)

    assert response.status_code == 422
    assert response.json()["code"] == expected_code
    assert expected_row in response.json()["message"]
    with api.session() as db:
        assert db.scalar(select(StudentRosterMember)) is None


def test_roster_import_size_limit_is_enforced(api, monkeypatch: pytest.MonkeyPatch) -> None:
    workbook = _workbook_bytes([("홍길동", "인공지능", "A74001")])
    monkeypatch.setattr(settings, "media_upload_max_bytes", len(workbook))

    accepted = api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("roster.xlsx", workbook, XLSX_MIME)},
        headers=api.headers["admin"],
    )
    rejected = api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("roster.xlsx", workbook + b"x", XLSX_MIME)},
        headers=api.headers["admin"],
    )

    assert accepted.status_code == 200
    assert rejected.status_code == 413
    assert rejected.json()["code"] == "PAYLOAD_TOO_LARGE"


def test_payment_import_replaces_all_and_once_and_lists_unpaid_roster(api) -> None:
    _import_roster(
        api,
        [
            ("전체누락", "AI", "A74001"),
            ("행사누락", "AI", "A74002"),
            ("신규전체", "AI", "A74003"),
        ],
    )
    board_id = _activity_board(api, slug="replace-all-once-board")
    roster = api.client.get(
        "/api/dues-payers/admin/roster",
        headers=api.headers["admin"],
    ).json()["data"]
    ids = {item["student_number"]: item["id"] for item in roster}
    api.client.put(
        f"/api/dues-payers/admin/payments/{ids['A74001']}",
        json={"payment_scope": "ALL", "once_board_id": None},
        headers=api.headers["admin"],
    )
    api.client.put(
        f"/api/dues-payers/admin/payments/{ids['A74002']}",
        json={"payment_scope": "ONCE", "once_board_id": board_id},
        headers=api.headers["admin"],
    )

    imported = _import_payments(api, [("신규전체", "무시", "A74003")])

    assert imported.status_code == 200
    assert imported.json()["data"] == {"cleared": 2, "registered": 1, "total_rows": 1}
    listing = api.client.get(
        "/api/dues-payers/admin/payments",
        headers=api.headers["admin"],
    )
    assert listing.status_code == 200
    assert {
        item["student_number"]: item["payment_scope"] for item in listing.json()["data"]
    } == {"A74001": "UNPAID", "A74002": "UNPAID", "A74003": "ALL"}
    with api.session() as db:
        log = db.scalar(
            select(OperationalAuditLog).where(OperationalAuditLog.action == "dues_payment.import")
        )
        assert log is not None
        assert log.details == {"cleared": 2, "registered": 1, "total_rows": 1}
        assert "신규전체" not in str(log.details)


def test_invalid_payment_import_preserves_current_snapshot_and_audit(api) -> None:
    _import_roster(api, [("정확한이름", "AI", "A74001")])
    with api.session() as db:
        member = db.scalar(select(StudentRosterMember))
        assert member is not None
        db.add(DuesPayment(roster_member_id=member.id, scope="ALL"))
        db.commit()

    rejected = _import_payments(api, [("다른이름", "AI", "A74001")])

    assert rejected.status_code == 422
    assert rejected.json()["code"] == "DUES_IMPORT_ROSTER_MISMATCH"
    with api.session() as db:
        assert db.scalar(select(func.count(DuesPayment.id))) == 1
        assert db.scalar(
            select(OperationalAuditLog).where(OperationalAuditLog.action == "dues_payment.import")
        ) is None


def test_admin_updates_payment_scope_without_editing_identity(api) -> None:
    _import_roster(api, [("고정이름", "인공지능", "A74101")])
    board_id = _activity_board(api, name="네트워킹", slug="individual-payment-board")
    with api.session() as db:
        member = db.scalar(select(StudentRosterMember))
        assert member is not None
        member_id = member.id

    once = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ONCE", "once_board_id": board_id},
        headers=api.headers["admin"],
    )
    all_paid = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ALL", "once_board_id": None},
        headers=api.headers["admin"],
    )
    unpaid = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "UNPAID", "once_board_id": None},
        headers=api.headers["admin"],
    )
    forbidden_identity = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ALL", "once_board_id": None, "name": "바꾸려는이름"},
        headers=api.headers["admin"],
    )

    assert once.status_code == 200
    assert once.json()["data"]["payment_scope"] == "ONCE"
    assert once.json()["data"]["once_board_name"] == "네트워킹"
    assert all_paid.status_code == 200
    assert all_paid.json()["data"]["payment_scope"] == "ALL"
    assert unpaid.status_code == 200
    assert unpaid.json()["data"]["payment_scope"] == "UNPAID"
    assert forbidden_identity.status_code == 422
    with api.session() as db:
        member = db.get(StudentRosterMember, member_id)
        assert member is not None
        assert (member.name, member.major, member.student_number) == (
            "고정이름",
            "인공지능",
            "A74101",
        )
        assert db.scalar(
            select(DuesPayment).where(DuesPayment.roster_member_id == member_id)
        ) is None
        audit_logs = db.scalars(
            select(OperationalAuditLog).where(
                OperationalAuditLog.action == "dues_payment.update"
            )
        ).all()
        assert len(audit_logs) == 3
        assert all(
            log.target_type == "student_roster" and log.target_id == member_id
            for log in audit_logs
        )


def test_invalid_payment_scope_board_and_missing_member_are_normalized(api) -> None:
    _import_roster(api, [("검증", "AI", "A74201")])
    inactive_board_id = _activity_board(api, slug="inactive-payment", is_active=False)
    with api.session() as db:
        member = db.scalar(select(StudentRosterMember))
        assert member is not None
        member_id = member.id

    all_with_board = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ALL", "once_board_id": 1},
        headers=api.headers["admin"],
    )
    once_without_board = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ONCE", "once_board_id": None},
        headers=api.headers["admin"],
    )
    inactive = api.client.put(
        f"/api/dues-payers/admin/payments/{member_id}",
        json={"payment_scope": "ONCE", "once_board_id": inactive_board_id},
        headers=api.headers["admin"],
    )
    missing = api.client.put(
        "/api/dues-payers/admin/payments/9999",
        json={"payment_scope": "UNPAID", "once_board_id": None},
        headers=api.headers["admin"],
    )

    assert (all_with_board.status_code, all_with_board.json()["code"]) == (422, "VALIDATION_ERROR")
    assert (once_without_board.status_code, once_without_board.json()["code"]) == (422, "VALIDATION_ERROR")
    assert (inactive.status_code, inactive.json()["code"]) == (422, "INVALID_DUES_BOARD")
    assert (missing.status_code, missing.json()["code"]) == (404, "ROSTER_MEMBER_NOT_FOUND")


def test_new_admin_routes_require_admin_and_removed_routes_return_404(api) -> None:
    forbidden = [
        api.client.get("/api/dues-payers/admin/roster", headers=api.headers["owner"]),
        api.client.get("/api/dues-payers/admin/payments", headers=api.headers["owner"]),
        _import_roster(api, [("추가", "AI", "A74001")], actor="owner"),
        _import_payments(api, [("추가", "AI", "A74001")], actor="owner"),
        api.client.put(
            "/api/dues-payers/admin/payments/1",
            json={"payment_scope": "UNPAID", "once_board_id": None},
            headers=api.headers["owner"],
        ),
    ]
    removed = [
        api.client.get("/api/dues-payers/admin/payers", headers=api.headers["admin"]),
        api.client.post("/api/dues-payers/admin/import", headers=api.headers["admin"]),
        api.client.post("/api/dues-payers/admin/payments/reset", headers=api.headers["admin"]),
    ]

    assert [response.status_code for response in forbidden] == [403, 403, 403, 403, 403]
    assert [response.status_code for response in removed] == [404, 404, 404]


def test_dues_mutations_share_one_serialization_gate(api, monkeypatch) -> None:
    def reject_mutation(_db) -> None:
        raise AppException(status_code=503, message="locked", code="TEST_DUES_LOCK")

    monkeypatch.setattr(dues_payers_router, "lock_dues_mutation", reject_mutation, raising=False)
    workbook = _workbook_bytes([("홍길동", "인공지능", "A74001")])
    responses = [
        api.client.post(
            "/api/dues-payers/admin/roster/import",
            files={"file": ("roster.xlsx", workbook, XLSX_MIME)},
            headers=api.headers["admin"],
        ),
        api.client.post(
            "/api/dues-payers/admin/payments/import",
            files={"file": ("payments.xlsx", workbook, XLSX_MIME)},
            headers=api.headers["admin"],
        ),
        api.client.put(
            "/api/dues-payers/admin/payments/1",
            json={"payment_scope": "UNPAID", "once_board_id": None},
            headers=api.headers["admin"],
        ),
    ]

    assert [(response.status_code, response.json().get("code")) for response in responses] == [
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
    ]
