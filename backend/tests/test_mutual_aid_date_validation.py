from datetime import date, datetime, timezone

import pytest

from app.models.media import MediaAsset
from app.models.post import Post
from app.models.post_extension import PostMutualAid
from app.routers import posts as posts_router


def _create_private_evidence(api, suffix: str) -> int:
    with api.session() as db:
        evidence = MediaAsset(
            owner_id=1,
            original_filename=f"evidence-{suffix}.pdf",
            stored_filename=f"private-evidence-{suffix}.pdf",
            content_type="application/pdf",
            file_size=123,
            url=f"/private-uploads/private-evidence-{suffix}.pdf",
            is_private=True,
            status="ready",
        )
        db.add(evidence)
        db.commit()
        return evidence.id


def _payload(evidence_id: int, event_date: str, *, content: str = "") -> dict:
    return {
        "title": "Wedding mutual-aid request",
        "content": content,
        "category": "wedding",
        "metadata": {"event_date": event_date, "relation": "self"},
        "attachment_ids": [evidence_id],
    }


def test_mutual_aid_minimum_date_uses_seoul_calendar_day() -> None:
    assert posts_router._minimum_mutual_aid_event_date(
        datetime(2026, 8, 1, 14, 59, 59, tzinfo=timezone.utc)
    ) == date(2026, 8, 1)
    assert posts_router._minimum_mutual_aid_event_date(
        datetime(2026, 8, 1, 15, 0, 0, tzinfo=timezone.utc)
    ) == date(2026, 8, 2)


def test_mutual_aid_create_rejects_past_and_accepts_today(
    api,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    evidence_id = _create_private_evidence(api, "create-boundary")
    monkeypatch.setattr(posts_router, "_minimum_mutual_aid_event_date", lambda: date(2026, 8, 4))

    response = api.client.post(
        "/api/boards/1/posts",
        json=_payload(evidence_id, "2026.08.03"),
        headers=api.headers["owner"],
    )
    assert response.status_code == 422
    assert response.json() == {
        "status": "error",
        "message": "Mutual-aid event date cannot be before today.",
        "code": "MUTUAL_AID_DATE_TOO_SOON",
    }

    allowed = api.client.post(
        "/api/boards/1/posts",
        json=_payload(evidence_id, "2026.08.04"),
        headers=api.headers["owner"],
    )
    assert allowed.status_code == 200
    with api.session() as db:
        mutual_aid = db.query(PostMutualAid).filter(PostMutualAid.post_id == allowed.json()["data"]["id"]).one()
        assert mutual_aid.event_date == date(2026, 8, 4)


def test_mutual_aid_update_validates_only_a_changed_event_date(
    api,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    evidence_id = _create_private_evidence(api, "update-boundary")
    monkeypatch.setattr(posts_router, "_minimum_mutual_aid_event_date", lambda: date(2026, 8, 4))
    created = api.client.post(
        "/api/boards/1/posts",
        json=_payload(evidence_id, "2026-08-04"),
        headers=api.headers["owner"],
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    rejected = api.client.put(
        f"/api/posts/{post_id}",
        json=_payload(evidence_id, "2026-08-03", content="must roll back"),
        headers=api.headers["owner"],
    )
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "MUTUAL_AID_DATE_TOO_SOON"
    with api.session() as db:
        assert db.get(Post, post_id).content == ""
        assert db.query(PostMutualAid).filter(PostMutualAid.post_id == post_id).one().event_date == date(2026, 8, 4)

    monkeypatch.setattr(posts_router, "_minimum_mutual_aid_event_date", lambda: date(2026, 8, 10))
    unchanged_legacy_date = api.client.put(
        f"/api/posts/{post_id}",
        json=_payload(evidence_id, "2026-08-04", content="updated remarks"),
        headers=api.headers["owner"],
    )
    assert unchanged_legacy_date.status_code == 200
    with api.session() as db:
        assert db.get(Post, post_id).content == "updated remarks"
        assert db.query(PostMutualAid).filter(PostMutualAid.post_id == post_id).one().event_date == date(2026, 8, 4)


def test_mutual_aid_accepts_evidence_link_instead_of_file(api, monkeypatch: pytest.MonkeyPatch) -> None:
    """증빙은 파일 첨부와 링크 첨부 중 하나면 된다."""

    monkeypatch.setattr(posts_router, "_minimum_mutual_aid_event_date", lambda: date(2026, 8, 4))
    base = {
        "title": "Wedding mutual-aid request",
        "content": "",
        "category": "wedding",
        "attachment_ids": [],
    }

    with_link = api.client.post(
        "/api/boards/1/posts",
        json={**base, "metadata": {"event_date": "2026-08-10", "relation": "self", "proof_url": "https://example.com/invite"}},
        headers=api.headers["owner"],
    )
    without_any = api.client.post(
        "/api/boards/1/posts",
        json={**base, "metadata": {"event_date": "2026-08-10", "relation": "self"}},
        headers=api.headers["owner"],
    )
    bad_scheme = api.client.post(
        "/api/boards/1/posts",
        json={**base, "metadata": {"event_date": "2026-08-10", "relation": "self", "proof_url": "javascript:alert(1)"}},
        headers=api.headers["owner"],
    )

    assert with_link.status_code == 200, with_link.text
    assert without_any.status_code == 400
    assert without_any.json()["code"] == "EVIDENCE_REQUIRED"
    assert bad_scheme.status_code == 422
    assert bad_scheme.json()["code"] == "VALIDATION_ERROR"

    with api.session() as db:
        post = db.get(Post, with_link.json()["data"]["id"])
        assert post.metadata_json["proof_url"] == "https://example.com/invite"
        assert db.query(PostMutualAid).filter(PostMutualAid.post_id == post.id).one().event_type == "wedding"


@pytest.mark.parametrize(
    "link",
    [
        "http://www.",
        "http://www",
        "https://example.",
        "https://.com",
        "https://example.c",
        "ftp://example.com",
        "example.com",
        "https://example.com/" + "a" * 500,
    ],
)
def test_evidence_link_rejects_incomplete_addresses(link: str) -> None:
    """QA: http://www. 처럼 도메인을 덜 입력해도 신청이 등록되던 문제."""

    with pytest.raises(Exception) as excinfo:
        posts_router._validate_evidence_link({"proof_url": link})
    assert getattr(excinfo.value, "code", None) == "VALIDATION_ERROR"


@pytest.mark.parametrize(
    "link",
    [
        "https://example.com",
        "http://www.example.com/invite?id=3",
        "  https://example.co.kr/a  ",
        "https://xn--hu5bp7l.xn--3e0b707e",
    ],
)
def test_evidence_link_accepts_normal_addresses(link: str) -> None:
    posts_router._validate_evidence_link({"proof_url": link})


def test_evidence_link_is_optional() -> None:
    posts_router._validate_evidence_link(None)
    posts_router._validate_evidence_link({})
    posts_router._validate_evidence_link({"proof_url": "   "})
