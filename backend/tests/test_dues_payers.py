from io import BytesIO

import pytest
from openpyxl import Workbook
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.errors import AppException
from app.models.audit import OperationalAuditLog
from app.models.board import Board
from app.models.dues_payer import DuesPayer
from app.routers import dues_payers as dues_payers_router


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
        files={"file": ("dues.xlsx", _workbook_bytes(rows), XLSX_MIME)},
        headers=api.headers[actor],
    )


def _import_payments(api, rows: list[tuple[object, ...]], *, actor: str = "admin"):
    return api.client.post(
        "/api/dues-payers/admin/import",
        files={"file": ("dues.xlsx", _workbook_bytes(rows), XLSX_MIME)},
        headers=api.headers[actor],
    )


def test_admin_roster_import_keeps_existing_students_and_adds_only_new_students(api) -> None:
    board_id = _activity_board(api)
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
            ("김민준", "데이터사이언스", "a74003"),
            ("이현화", "정보처리", "A34011"),
            ("홍길동", "보안 및 블록체인", "A74099"),
        ],
    )

    assert first.status_code == 200
    assert first.json()["data"] == {"created": 2, "updated": 0, "unchanged": 0, "total_rows": 2}
    assert second.status_code == 200
    assert second.json()["data"] == {"created": 1, "updated": 0, "unchanged": 2, "total_rows": 3}

    by_name = api.client.get(
        "/api/dues-payers/search",
        params={"q": "김민", "board_id": board_id},
        headers=api.headers["owner"],
    )
    by_number = api.client.get(
        "/api/dues-payers/search",
        params={"q": "A34011", "board_id": board_id},
        headers=api.headers["owner"],
    )

    assert by_name.status_code == 200
    assert by_name.json()["data"] == [
        {
            "id": 1,
            "name": "김민준",
            "major": "데이터사이언스",
            "student_number": "A74003",
            "is_paid_for_board": False,
        }
    ]
    # 학번으로는 검색되지 않아야 한다(이름 전용).
    assert by_number.status_code == 200
    assert by_number.json()["data"] == []


def test_member_search_returns_all_roster_states_with_board_eligibility_only(api) -> None:
    current_board_id = _activity_board(api, name="현재 행사", slug="current-activity-dues")
    other_board_id = _activity_board(api, name="다른 행사", slug="other-activity-dues")
    with api.session() as db:
        db.add_all(
            [
                DuesPayer(name="검증기존전체", major="인공지능", student_number="A74501", is_full_paid=True),
                DuesPayer(
                    name="검증현재행사",
                    major="인공지능",
                    student_number="A74502",
                    once_board_id=current_board_id,
                ),
                DuesPayer(
                    name="검증다른행사",
                    major="인공지능",
                    student_number="A74503",
                    once_board_id=other_board_id,
                ),
                DuesPayer(name="검증미납", major="인공지능", student_number="A74504"),
            ]
        )
        db.commit()

    response = api.client.get(
        "/api/dues-payers/search",
        params={"q": "검증", "board_id": current_board_id},
        headers=api.headers["owner"],
    )
    by_number = api.client.get(
        "/api/dues-payers/search",
        params={"q": "A745", "board_id": current_board_id},
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    assert [(item["name"], item["is_paid_for_board"]) for item in response.json()["data"]] == [
        ("검증기존전체", True),
        ("검증다른행사", False),
        ("검증미납", False),
        ("검증현재행사", True),
    ]
    assert all(
        "payment_scope" not in item and "once_board_id" not in item
        for item in response.json()["data"]
    )
    assert by_number.status_code == 200
    assert by_number.json()["data"] == []


def test_member_search_rejects_missing_inactive_ordinary_and_unknown_boards(api) -> None:
    inactive_board_id = _activity_board(api, slug="inactive-search-dues", is_active=False)

    responses = [
        api.client.get(
            "/api/dues-payers/search",
            params={"q": "검증"},
            headers=api.headers["owner"],
        ),
        api.client.get(
            "/api/dues-payers/search",
            params={"q": "검증", "board_id": inactive_board_id},
            headers=api.headers["owner"],
        ),
        api.client.get(
            "/api/dues-payers/search",
            params={"q": "검증", "board_id": 2},
            headers=api.headers["owner"],
        ),
        api.client.get(
            "/api/dues-payers/search",
            params={"q": "검증", "board_id": 9999},
            headers=api.headers["owner"],
        ),
    ]

    assert [(response.status_code, response.json().get("code")) for response in responses] == [
        (422, "INVALID_DUES_BOARD"),
        (422, "INVALID_DUES_BOARD"),
        (422, "INVALID_DUES_BOARD"),
        (422, "INVALID_DUES_BOARD"),
    ]


def test_admin_roster_search_is_paginated_and_not_available_to_members(api) -> None:
    _import_roster(
        api,
        [
            ("가나다", "인공지능", "A74001"),
            ("라마바", "인공지능", "A74002"),
            ("사아자", "인공지능", "A74003"),
        ],
    )

    page = api.client.get(
        "/api/dues-payers/admin/payers",
        params={"q": "A74", "page": 2, "size": 2},
        headers=api.headers["admin"],
    )
    forbidden_list = api.client.get(
        "/api/dues-payers/admin/payers",
        headers=api.headers["owner"],
    )
    forbidden_roster_import = _import_roster(api, [("추가", "인공지능", "A74004")], actor="owner")
    forbidden_payment_import = _import_payments(api, [("추가", "인공지능", "A74004")], actor="owner")

    assert page.status_code == 200
    assert [item["student_number"] for item in page.json()["data"]] == ["A74003"]
    assert page.json()["pagination"] == {"page": 2, "size": 2, "total": 3, "total_pages": 2}
    assert forbidden_list.status_code == 403
    assert forbidden_roster_import.status_code == 403
    assert forbidden_payment_import.status_code == 403


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
def test_invalid_rows_reject_the_entire_workbook(api, rows, expected_code: str, expected_row: str) -> None:
    with api.session() as db:
        db.add(DuesPayer(name="기존", major="정보처리", student_number="A34011"))
        db.commit()

    response = _import_roster(api, rows)

    assert response.status_code == 422
    assert response.json()["code"] == expected_code
    assert expected_row in response.json()["message"]
    with api.session() as db:
        assert db.scalars(select(DuesPayer).order_by(DuesPayer.id)).all()[0].student_number == "A34011"
        assert db.scalar(select(DuesPayer).where(DuesPayer.student_number != "A34011")) is None


def test_invalid_or_empty_workbook_is_rejected_without_changes(api) -> None:
    invalid = api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("dues.xlsx", b"not a workbook", XLSX_MIME)},
        headers=api.headers["admin"],
    )
    empty = _import_roster(api, [])

    assert invalid.status_code == 422
    assert invalid.json()["code"] == "INVALID_DUES_WORKBOOK"
    assert empty.status_code == 422
    assert empty.json()["code"] == "INVALID_DUES_WORKBOOK"
    with api.session() as db:
        assert db.scalar(select(DuesPayer)) is None


def test_admin_import_accepts_exact_limit_and_rejects_one_byte_over_without_changes(
    api, monkeypatch: pytest.MonkeyPatch
) -> None:
    workbook = _workbook_bytes([("홍길동", "인공지능", "A74001")])
    monkeypatch.setattr(settings, "media_upload_max_bytes", len(workbook))

    accepted = api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("dues.xlsx", workbook, XLSX_MIME)},
        headers=api.headers["admin"],
    )
    rejected = api.client.post(
        "/api/dues-payers/admin/roster/import",
        files={"file": ("dues.xlsx", workbook + b"x", XLSX_MIME)},
        headers=api.headers["admin"],
    )

    assert accepted.status_code == 200
    assert rejected.status_code == 413
    assert rejected.json()["code"] == "PAYLOAD_TOO_LARGE"
    with api.session() as db:
        payers = db.scalars(select(DuesPayer)).all()
        assert len(payers) == 1
        assert payers[0].student_number == "A74001"


def test_payment_reset_keeps_roster_clears_all_and_preserves_once(api) -> None:
    board_id = _activity_board(api)
    with api.session() as db:
        db.add_all(
            [
                DuesPayer(name="전체납부", major="인공지능", student_number="A74001", is_full_paid=True),
                DuesPayer(name="행사납부", major="보안", student_number="A74002", once_board_id=board_id),
                DuesPayer(name="미납", major="데이터", student_number="A74003"),
            ]
        )
        db.commit()

    wrong = api.client.post(
        "/api/dues-payers/admin/payments/reset",
        json={"confirmation": "초기화"},
        headers=api.headers["admin"],
    )
    with api.session() as db:
        assert db.scalar(select(DuesPayer).where(DuesPayer.student_number == "A74001")).is_full_paid is True

    reset = api.client.post(
        "/api/dues-payers/admin/payments/reset",
        json={"confirmation": "납부자 초기화"},
        headers=api.headers["admin"],
    )

    assert wrong.status_code == 400
    assert wrong.json()["code"] == "DUES_RESET_CONFIRMATION_REQUIRED"
    assert reset.status_code == 200
    assert reset.json()["data"] == {"reset": 1}
    with api.session() as db:
        payers = {
            payer.student_number: payer
            for payer in db.scalars(select(DuesPayer).order_by(DuesPayer.student_number)).all()
        }
        assert len(payers) == 3
        assert (payers["A74001"].is_full_paid, payers["A74001"].once_board_id) == (False, None)
        assert (payers["A74002"].is_full_paid, payers["A74002"].once_board_id) == (False, board_id)
        assert (payers["A74003"].is_full_paid, payers["A74003"].once_board_id) == (False, None)
        logs = db.scalars(
            select(OperationalAuditLog)
            .where(OperationalAuditLog.target_type == "dues_payer")
            .order_by(OperationalAuditLog.id)
        ).all()
        assert [(log.action, log.details) for log in logs] == [
            ("dues_payer.payment_reset", {"reset": 1}),
        ]
        assert "전체납부" not in str([(log.action, log.details) for log in logs])


def test_dues_mutations_share_one_serialization_gate(api, monkeypatch) -> None:
    def reject_mutation(_db) -> None:
        raise AppException(status_code=503, message="locked", code="TEST_DUES_LOCK")

    monkeypatch.setattr(dues_payers_router, "lock_dues_payer_mutation", reject_mutation, raising=False)
    workbook = _workbook_bytes([("홍길동", "인공지능", "A74001")])
    responses = [
        api.client.post(
            "/api/dues-payers/admin/payers",
            headers=api.headers["admin"],
            json={
                "name": "홍길동",
                "major": "인공지능",
                "student_number": "A74001",
                "payment_scope": "UNPAID",
                "once_board_id": None,
            },
        ),
        api.client.put(
            "/api/dues-payers/admin/payers/999",
            headers=api.headers["admin"],
            json={
                "name": "홍길동",
                "major": "인공지능",
                "student_number": "A74001",
                "payment_scope": "UNPAID",
                "once_board_id": None,
            },
        ),
        api.client.post(
            "/api/dues-payers/admin/roster/import",
            files={"file": ("dues.xlsx", workbook, XLSX_MIME)},
            headers=api.headers["admin"],
        ),
        api.client.post(
            "/api/dues-payers/admin/import",
            files={"file": ("dues.xlsx", workbook, XLSX_MIME)},
            headers=api.headers["admin"],
        ),
        api.client.post(
            "/api/dues-payers/admin/payments/reset",
            json={"confirmation": "납부자 초기화"},
            headers=api.headers["admin"],
        ),
    ]

    assert [(response.status_code, response.json().get("code")) for response in responses] == [
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
        (503, "TEST_DUES_LOCK"),
    ]
    with api.session() as db:
        assert db.scalar(select(DuesPayer)) is None


def test_payment_reset_requires_admin_and_removed_delete_route_stays_unavailable(api) -> None:
    with api.session() as db:
        db.add(DuesPayer(name="전체납부", major="인공지능", student_number="A74001", is_full_paid=True))
        db.commit()

    member = api.client.post(
        "/api/dues-payers/admin/payments/reset",
        json={"confirmation": "납부자 초기화"},
        headers=api.headers["owner"],
    )
    guest = api.client.post(
        "/api/dues-payers/admin/payments/reset",
        json={"confirmation": "납부자 초기화"},
    )
    removed = api.client.post(
        "/api/dues-payers/admin/delete-all",
        json={"confirmation": "진짜 삭제"},
        headers=api.headers["admin"],
    )

    assert member.status_code == 403
    assert guest.status_code == 401
    assert removed.status_code == 404
    with api.session() as db:
        payer = db.scalar(select(DuesPayer).where(DuesPayer.student_number == "A74001"))
        assert payer is not None
        assert payer.is_full_paid is True


def test_admin_user_api_does_not_expose_or_change_legacy_dues_status(api) -> None:
    update = api.client.put(
        "/api/users/admin/users/1",
        json={"dues_status": "unpaid"},
        headers=api.headers["admin"],
    )
    listing = api.client.get("/api/users/admin/users", headers=api.headers["admin"])

    assert update.status_code == 422
    assert listing.status_code == 200
    assert all("dues_status" not in item for item in listing.json()["data"])


def test_roster_import_rejects_conflicting_identity_without_changing_existing_roster(api) -> None:
    with api.session() as db:
        db.add(
            DuesPayer(
                name="기존이름",
                major="기존전공",
                student_number="A74001",
                is_full_paid=False,
                once_board_id=1,
            )
        )
        db.commit()

    response = _import_roster(api, [("변경이름", "변경전공", "A74001")])

    assert response.status_code == 422
    assert response.json()["code"] == "DUES_ROSTER_IDENTITY_CONFLICT"
    with api.session() as db:
        payer = db.scalar(select(DuesPayer).where(DuesPayer.student_number == "A74001"))
        assert payer is not None
        assert (payer.name, payer.major) == ("기존이름", "기존전공")
        assert payer.is_full_paid is False
        assert payer.once_board_id == 1


def test_roster_import_translates_commit_race_and_rolls_back(api, monkeypatch) -> None:
    session_class = api.session_factory.class_
    original_commit = session_class.commit

    def fail_roster_commit(session) -> None:
        if any(isinstance(item, DuesPayer) for item in session.new):
            raise IntegrityError("INSERT INTO dues_payers", {}, RuntimeError("simulated race"))
        original_commit(session)

    monkeypatch.setattr(session_class, "commit", fail_roster_commit)

    response = _import_roster(api, [("신입원우", "인공지능", "A74001")])

    assert response.status_code == 422
    assert response.json()["code"] == "DUES_ROSTER_IDENTITY_CONFLICT"
    with api.session() as db:
        assert db.scalar(select(DuesPayer)) is None
        assert db.scalar(
            select(OperationalAuditLog).where(OperationalAuditLog.action == "dues_payer.roster_import")
        ) is None


def _activity_board(api, *, name: str = "스터디 인증", slug: str = "study-dues", is_active: bool = True) -> int:
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


def _create_payer(
    api,
    *,
    student_number: str,
    payment_scope: str,
    once_board_id: int | None = None,
    actor: str = "admin",
):
    return api.client.post(
        "/api/dues-payers/admin/payers",
        headers=api.headers[actor],
        json={
            "name": f"검증{student_number}",
            "major": "인공지능",
            "student_number": student_number,
            "payment_scope": payment_scope,
            "once_board_id": once_board_id,
        },
    )


def test_payment_snapshot_resets_omitted_all_preserves_once_and_promotes_matches(api) -> None:
    with api.session() as db:
        db.add_all(
            [
                DuesPayer(name="전체누락", major="인공지능", student_number="A74001", is_full_paid=True),
                DuesPayer(
                    name="행사유지",
                    major="인공지능",
                    student_number="A74002",
                    once_board_id=1,
                ),
                DuesPayer(
                    name="행사승격",
                    major="인공지능",
                    student_number="A74003",
                    once_board_id=2,
                ),
                DuesPayer(name="전체유지", major="인공지능", student_number="A74004", is_full_paid=True),
                DuesPayer(name="미납승격", major="인공지능", student_number="A74005"),
            ]
        )
        db.commit()

    response = _import_payments(
        api,
        [
            ("행사승격", "무시되는전공", "A74003"),
            ("전체유지", "무시되는전공", "A74004"),
            ("미납승격", "무시되는전공", "A74005"),
        ],
    )

    assert response.status_code == 200
    assert response.json()["data"] == {"activated": 2, "reset": 1, "unchanged": 1, "total_rows": 3}
    with api.session() as db:
        payers = {
            payer.student_number: payer
            for payer in db.scalars(select(DuesPayer).order_by(DuesPayer.student_number)).all()
        }
        assert (payers["A74001"].is_full_paid, payers["A74001"].once_board_id) == (False, None)
        assert (payers["A74002"].is_full_paid, payers["A74002"].once_board_id) == (False, 1)
        assert (payers["A74003"].is_full_paid, payers["A74003"].once_board_id) == (True, None)
        assert (payers["A74004"].is_full_paid, payers["A74004"].once_board_id) == (True, None)
        assert (payers["A74005"].is_full_paid, payers["A74005"].once_board_id) == (True, None)


def test_payment_snapshot_roster_mismatch_rolls_back_all_state_and_audits_no_pii(api) -> None:
    with api.session() as db:
        db.add_all(
            [
                DuesPayer(name="전체납부", major="인공지능", student_number="A74001", is_full_paid=True),
                DuesPayer(name="정확한이름", major="인공지능", student_number="A74002"),
            ]
        )
        db.commit()

    rejected = _import_payments(
        api,
        [
            ("전체납부", "인공지능", "A74001"),
            ("다른이름", "인공지능", "A74002"),
        ],
    )

    assert rejected.status_code == 422
    assert rejected.json()["code"] == "DUES_IMPORT_ROSTER_MISMATCH"
    assert "2" in rejected.json()["message"]
    with api.session() as db:
        payers = {
            payer.student_number: payer
            for payer in db.scalars(select(DuesPayer).order_by(DuesPayer.student_number)).all()
        }
        assert payers["A74001"].is_full_paid is True
        assert payers["A74002"].is_full_paid is False
        assert db.scalar(
            select(OperationalAuditLog).where(OperationalAuditLog.action == "dues_payer.payment_import")
        ) is None

    accepted = _import_payments(api, [("정확한이름", "인공지능", "A74002")])

    assert accepted.status_code == 200
    with api.session() as db:
        log = db.scalar(
            select(OperationalAuditLog).where(OperationalAuditLog.action == "dues_payer.payment_import")
        )
        assert log is not None
        assert log.details == {"activated": 1, "reset": 1, "unchanged": 0, "total_rows": 1}
        assert "정확한이름" not in str(log.details)
        assert "A74002" not in str(log.details)


def test_admin_can_create_all_once_and_unpaid_payment_scopes(api) -> None:
    board_id = _activity_board(api)

    all_paid = _create_payer(api, student_number="A74101", payment_scope="ALL")
    once = _create_payer(
        api,
        student_number="A74102",
        payment_scope="ONCE",
        once_board_id=board_id,
    )
    unpaid = _create_payer(api, student_number="A74103", payment_scope="UNPAID")

    assert all_paid.status_code == 200
    assert all_paid.json()["data"] == {
        "id": 1,
        "name": "검증A74101",
        "major": "인공지능",
        "student_number": "A74101",
        "payment_scope": "ALL",
        "is_full_paid": True,
        "once_board_id": None,
        "once_board_name": None,
    }
    assert once.status_code == 200
    assert once.json()["data"]["payment_scope"] == "ONCE"
    assert once.json()["data"]["is_full_paid"] is False
    assert once.json()["data"]["once_board_id"] == board_id
    assert once.json()["data"]["once_board_name"] == "스터디 인증"
    assert unpaid.status_code == 200
    assert unpaid.json()["data"]["payment_scope"] == "UNPAID"

    with api.session() as db:
        logs = db.scalars(
            select(OperationalAuditLog)
            .where(OperationalAuditLog.action == "dues_payer.create")
            .order_by(OperationalAuditLog.id)
        ).all()
        assert [log.details["payment_scope"] for log in logs] == ["ALL", "ONCE", "UNPAID"]
        assert "검증A74101" not in str([log.details for log in logs])
        assert "A74101" not in str([log.details for log in logs])


def test_invalid_dues_scope_shapes_and_boards_are_rejected(api) -> None:
    inactive_board_id = _activity_board(api, slug="inactive-dues", is_active=False)

    all_with_board = _create_payer(
        api,
        student_number="A74201",
        payment_scope="ALL",
        once_board_id=1,
    )
    once_without_board = _create_payer(api, student_number="A74202", payment_scope="ONCE")
    once_non_activity = _create_payer(
        api,
        student_number="A74203",
        payment_scope="ONCE",
        once_board_id=2,
    )
    once_inactive = _create_payer(
        api,
        student_number="A74204",
        payment_scope="ONCE",
        once_board_id=inactive_board_id,
    )
    blank_name = api.client.post(
        "/api/dues-payers/admin/payers",
        headers=api.headers["admin"],
        json={
            "name": "   ",
            "major": "인공지능",
            "student_number": "A74205",
            "payment_scope": "UNPAID",
        },
    )

    assert all_with_board.status_code == 422
    assert all_with_board.json()["code"] == "VALIDATION_ERROR"
    assert once_without_board.status_code == 422
    assert once_without_board.json()["code"] == "VALIDATION_ERROR"
    assert once_non_activity.status_code == 422
    assert once_non_activity.json()["code"] == "INVALID_DUES_BOARD"
    assert once_inactive.status_code == 422
    assert once_inactive.json()["code"] == "INVALID_DUES_BOARD"
    assert blank_name.status_code == 422
    assert blank_name.json()["code"] == "VALIDATION_ERROR"


def test_admin_can_update_payment_scope_and_list_uses_current_board_name(api) -> None:
    board_id = _activity_board(api, name="변경 전 행사")
    created = _create_payer(api, student_number="A74301", payment_scope="UNPAID")
    payer_id = created.json()["data"]["id"]

    updated = api.client.put(
        f"/api/dues-payers/admin/payers/{payer_id}",
        headers=api.headers["admin"],
        json={
            "name": "수정된 이름",
            "major": "데이터사이언스",
            "student_number": "a74301",
            "payment_scope": "ONCE",
            "once_board_id": board_id,
        },
    )

    assert updated.status_code == 200
    assert updated.json()["data"]["student_number"] == "A74301"
    assert updated.json()["data"]["once_board_name"] == "변경 전 행사"

    with api.session() as db:
        board = db.get(Board, board_id)
        assert board is not None
        board.name = "변경 후 행사"
        db.commit()

    renamed = api.client.get(
        "/api/dues-payers/admin/payers",
        headers=api.headers["admin"],
        params={"q": "A74301"},
    )
    assert renamed.status_code == 200
    assert renamed.json()["data"][0]["once_board_name"] == "변경 후 행사"

    with api.session() as db:
        board = db.get(Board, board_id)
        assert board is not None
        db.delete(board)
        db.commit()

    deleted = api.client.get(
        "/api/dues-payers/admin/payers",
        headers=api.headers["admin"],
        params={"q": "A74301"},
    )
    assert deleted.status_code == 200
    assert deleted.json()["data"][0]["payment_scope"] == "UNPAID"
    assert deleted.json()["data"][0]["once_board_id"] is None
    assert deleted.json()["data"][0]["once_board_name"] is None


def test_individual_payment_scope_conflict_missing_and_member_authorization(api) -> None:
    created = _create_payer(api, student_number="A74401", payment_scope="ALL")
    duplicate = _create_payer(api, student_number="a74401", payment_scope="UNPAID")
    missing = api.client.put(
        "/api/dues-payers/admin/payers/9999",
        headers=api.headers["admin"],
        json={
            "name": "없음",
            "major": "인공지능",
            "student_number": "A74402",
            "payment_scope": "UNPAID",
        },
    )
    forbidden_create = _create_payer(
        api,
        student_number="A74403",
        payment_scope="UNPAID",
        actor="owner",
    )
    forbidden_update = api.client.put(
        f"/api/dues-payers/admin/payers/{created.json()['data']['id']}",
        headers=api.headers["owner"],
        json={
            "name": "권한없음",
            "major": "인공지능",
            "student_number": "A74401",
            "payment_scope": "UNPAID",
        },
    )

    assert duplicate.status_code == 409
    assert duplicate.json()["code"] == "DUES_STUDENT_NUMBER_CONFLICT"
    assert missing.status_code == 404
    assert missing.json()["code"] == "DUES_PAYER_NOT_FOUND"
    assert forbidden_create.status_code == 403
    assert forbidden_update.status_code == 403
