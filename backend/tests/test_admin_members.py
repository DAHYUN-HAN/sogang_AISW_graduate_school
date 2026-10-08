import pytest
from sqlalchemy import select

from app.models.audit import OperationalAuditLog
from app.models.post import Post
from app.models.registration import MajorOption
from app.models.user import User


def test_admin_edits_member_profile_without_changing_identity_or_author_snapshots(api):
    with api.session() as db:
        db.add(MajorOption(name="AI", sort_order=1, is_active=True))
        post = db.get(Post, 3)
        post.author_nickname_snapshot = "Original name"
        post.author_cohort_snapshot = "71"
        db.commit()
    payload = {
        "nickname": "  Member   Name  ", "cohort": "72", "major": "AI",
        "phone": "010-1234-5678", "company": "Campus", "job_title": "Engineer",
        "position": "Member", "enrollment_status": "leave",
    }
    response = api.client.put("/api/users/admin/users/1", headers=api.headers["admin"], json=payload)
    assert response.status_code == 200
    with api.session() as db:
        member = db.get(User, 1)
        assert member.nickname == "Member Name"
        assert member.cohort == "72" and member.major == "AI"
        assert member.phone == payload["phone"] and member.company == "Campus"
        assert member.job_title == "Engineer" and member.position == "Member"
        assert member.email == "owner@sogang.ac.kr" and member.role == "user"
        assert member.enrollment_status == "leave"
        post = db.get(Post, 3)
        assert (post.author_nickname_snapshot, post.author_cohort_snapshot) == ("Original name", "71")
        audit = db.scalar(select(OperationalAuditLog).where(OperationalAuditLog.action == "user.update"))
        assert set(audit.details["changed_fields"]) == set(payload)
        assert payload["phone"] not in str(audit.details)


@pytest.mark.parametrize("payload", [
    {"nickname": "  "}, {"nickname": None}, {"nickname": "x" * 51},
    {"cohort": "x" * 21}, {"phone": "x" * 21}, {"major": "Unknown major"},
    {"role": None}, {"is_active": None}, {"enrollment_status": None},
    {"email": "replacement@sogang.ac.kr"}, {"dues_status": "paid"},
])
def test_admin_rejects_invalid_profile_changes_atomically(api, payload):
    response = api.client.put("/api/users/admin/users/1", headers=api.headers["admin"], json=payload)
    assert response.status_code == 422
    with api.session() as db:
        assert db.get(User, 1).nickname == "Owner"
        assert db.scalar(select(OperationalAuditLog.id)) is None


def test_member_profile_update_is_admin_only_and_self_deactivation_stays_blocked(api):
    for headers in ({}, api.headers["owner"]):
        listed = api.client.get("/api/users/admin/users", headers=headers)
        assert listed.status_code in (401, 403)
        response = api.client.put("/api/users/admin/users/2", headers=headers, json={"nickname": "Edited"})
        assert response.status_code in (401, 403)
    response = api.client.put("/api/users/admin/users/3", headers=api.headers["admin"], json={"is_active": False})
    assert response.status_code == 400


def test_member_search_trims_keyword_and_filters_before_pagination(api):
    response = api.client.get("/api/users/admin/users", headers=api.headers["admin"], params={"q": "  Owner  ", "size": 1})
    assert response.status_code == 200
    assert [item["id"] for item in response.json()["data"]] == [1]
    assert response.json()["pagination"]["total"] == 1


def test_blank_optional_fields_clear_and_unchanged_save_does_not_log(api):
    with api.session() as db:
        member = db.get(User, 1)
        member.phone = "123"
        db.commit()
    for payload in ({"phone": "  "}, {"nickname": "Owner"}):
        response = api.client.put("/api/users/admin/users/1", headers=api.headers["admin"], json=payload)
        assert response.status_code == 200
    with api.session() as db:
        assert db.get(User, 1).phone is None
        assert len(db.scalars(select(OperationalAuditLog)).all()) == 1


def test_filtered_member_list_covers_every_page(api):
    with api.session() as db:
        owner = db.get(User, 1)
        db.add_all([User(username=f"paged{index}", email=f"paged{index}@sogang.ac.kr",
                         nickname=f"Paged Member {index}", cohort="73", password_hash=owner.password_hash,
                         is_active=index != 0) for index in range(25)])
        db.commit()
    pages = [api.client.get("/api/users/admin/users", headers=api.headers["admin"],
                            params={"q": " Paged Member ", "is_active": "true", "page": page, "size": 20}).json()
             for page in (1, 2)]
    assert [len(result["data"]) for result in pages] == [20, 4]
    assert all(result["pagination"]["total"] == 24 and result["pagination"]["total_pages"] == 2 for result in pages)
    assert len({member["id"] for result in pages for member in result["data"]}) == 24


def test_inactive_major_rejects_entire_update_and_legacy_major_can_be_retained(api):
    with api.session() as db:
        db.add(MajorOption(name="Retired", is_active=False))
        db.get(User, 1).major = "Legacy"
        db.commit()
    rejected = api.client.put("/api/users/admin/users/1", headers=api.headers["admin"],
                              json={"nickname": "Changed", "major": "Retired"})
    assert rejected.status_code == 422
    with api.session() as db:
        assert db.get(User, 1).nickname == "Owner"
        assert db.scalar(select(OperationalAuditLog.id)) is None
    accepted = api.client.put("/api/users/admin/users/1", headers=api.headers["admin"],
                              json={"nickname": "Changed", "major": "Legacy"})
    assert accepted.status_code == 200
