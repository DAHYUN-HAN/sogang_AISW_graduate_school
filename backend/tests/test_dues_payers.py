from io import BytesIO

import pytest
from openpyxl import Workbook
from sqlalchemy import select

from app.config import settings
from app.models.audit import OperationalAuditLog
from app.models.dues_payer import DuesPayer


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


def _import(api, rows: list[tuple[object, ...]], *, actor: str = "admin"):
    return api.client.post(
        "/api/dues-payers/admin/import",
        files={"file": ("dues.xlsx", _workbook_bytes(rows), XLSX_MIME)},
        headers=api.headers[actor],
    )


def test_admin_import_upserts_by_student_number_and_members_search_name_or_number(api) -> None:
    first = _import(
        api,
        [
            ("김민준", "데이터사이언스", "A74003"),
            ("이현화", "정보처리", "A34011"),
        ],
    )
    second = _import(
        api,
        [
            ("김민준", "인공지능", "a74003"),
            ("이현화", "정보처리", "A34011"),
            ("홍길동", "보안 및 블록체인", "A74099"),
        ],
    )

    assert first.status_code == 200
    assert first.json()["data"] == {"created": 2, "updated": 0, "unchanged": 0, "total_rows": 2}
    assert second.status_code == 200
    assert second.json()["data"] == {"created": 1, "updated": 1, "unchanged": 1, "total_rows": 3}

    by_name = api.client.get(
        "/api/dues-payers/search",
        params={"q": "김민"},
        headers=api.headers["owner"],
    )
    by_number = api.client.get(
        "/api/dues-payers/search",
        params={"q": "A34011"},
        headers=api.headers["owner"],
    )

    assert by_name.status_code == 200
    assert by_name.json()["data"] == [
        {"id": 1, "name": "김민준", "major": "인공지능", "student_number": "A74003"}
    ]
    # 학번으로는 검색되지 않아야 한다(이름 전용).
    assert by_number.status_code == 200
    assert by_number.json()["data"] == []


def test_admin_roster_search_is_paginated_and_not_available_to_members(api) -> None:
    _import(
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
    forbidden_import = _import(api, [("추가", "인공지능", "A74004")], actor="owner")

    assert page.status_code == 200
    assert [item["student_number"] for item in page.json()["data"]] == ["A74003"]
    assert page.json()["pagination"] == {"page": 2, "size": 2, "total": 3, "total_pages": 2}
    assert forbidden_list.status_code == 403
    assert forbidden_import.status_code == 403


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

    response = _import(api, rows)

    assert response.status_code == 422
    assert response.json()["code"] == expected_code
    assert expected_row in response.json()["message"]
    with api.session() as db:
        assert db.scalars(select(DuesPayer).order_by(DuesPayer.id)).all()[0].student_number == "A34011"
        assert db.scalar(select(DuesPayer).where(DuesPayer.student_number != "A34011")) is None


def test_invalid_or_empty_workbook_is_rejected_without_changes(api) -> None:
    invalid = api.client.post(
        "/api/dues-payers/admin/import",
        files={"file": ("dues.xlsx", b"not a workbook", XLSX_MIME)},
        headers=api.headers["admin"],
    )
    empty = _import(api, [])

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
        "/api/dues-payers/admin/import",
        files={"file": ("dues.xlsx", workbook, XLSX_MIME)},
        headers=api.headers["admin"],
    )
    rejected = api.client.post(
        "/api/dues-payers/admin/import",
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


def test_exact_confirmation_permanently_deletes_roster_and_audits_counts_without_pii(api) -> None:
    _import(api, [("홍길동", "인공지능", "A74001"), ("김서강", "보안", "A74002")])

    wrong = api.client.post(
        "/api/dues-payers/admin/delete-all",
        json={"confirmation": "진짜삭제"},
        headers=api.headers["admin"],
    )
    with api.session() as db:
        assert len(db.scalars(select(DuesPayer)).all()) == 2

    deleted = api.client.post(
        "/api/dues-payers/admin/delete-all",
        json={"confirmation": "진짜 삭제"},
        headers=api.headers["admin"],
    )

    assert wrong.status_code == 400
    assert wrong.json()["code"] == "DUES_DELETE_CONFIRMATION_REQUIRED"
    assert deleted.status_code == 200
    assert deleted.json()["data"] == {"deleted": 2}
    with api.session() as db:
        assert db.scalar(select(DuesPayer)) is None
        logs = db.scalars(
            select(OperationalAuditLog)
            .where(OperationalAuditLog.target_type == "dues_payer")
            .order_by(OperationalAuditLog.id)
        ).all()
        assert [(log.action, log.details) for log in logs] == [
            ("dues_payer.import", {"created": 2, "updated": 0, "unchanged": 0, "total_rows": 2}),
            ("dues_payer.delete_all", {"deleted": 2}),
        ]
        assert "홍길동" not in str([(log.action, log.details) for log in logs])


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
