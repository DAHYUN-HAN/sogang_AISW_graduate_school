"""일정에 짝지은 공지로만 이동한다. 일정 전용 화면을 없애면서 생긴 규칙이다."""

from datetime import datetime, timedelta

import pytest

from app.models.board import Board
from app.models.event import Event
from app.models.notification import Notification
from app.models.post import Post


def _setup(api) -> dict[str, int]:
    with api.session() as db:
        board = Board(
            name="학사 공지",
            slug="academic-notices-link-test",
            category="notices",
            board_type="notice",
            read_permission="user",
            write_permission="admin",
        )
        db.add(board)
        db.flush()
        published = Post(board_id=board.id, author_id=3, title="등록 안내", content="c", status="published")
        hidden = Post(board_id=board.id, author_id=3, title="비공개 공지", content="c", status="hidden")
        removed = Post(
            board_id=board.id,
            author_id=3,
            title="지워진 공지",
            content="c",
            status="published",
            deleted_at=datetime.utcnow(),
        )
        db.add_all([published, hidden, removed])
        db.flush()
        start = datetime.utcnow() + timedelta(days=1)
        linked = Event(title="연계 있음", category="academic", start_at=start, notice_post_id=published.id)
        plain = Event(title="연계 없음", category="academic", start_at=start)
        to_hidden = Event(title="비공개 연계", category="event", start_at=start, notice_post_id=hidden.id)
        to_removed = Event(title="삭제 연계", category="other", start_at=start, notice_post_id=removed.id)
        db.add_all([linked, plain, to_hidden, to_removed])
        db.commit()
        return {
            "published": published.id,
            "linked": linked.id,
            "plain": plain.id,
            "to_hidden": to_hidden.id,
            "to_removed": to_removed.id,
        }


def _events_by_id(api) -> dict[int, dict]:
    response = api.client.get("/api/events", headers=api.headers["owner"])
    assert response.status_code == 200
    return {item["id"]: item for item in response.json()["data"]}


def test_event_list_exposes_only_openable_notice_links(api) -> None:
    ids = _setup(api)
    events = _events_by_id(api)

    assert events[ids["linked"]]["notice_post_id"] == ids["published"]
    assert events[ids["plain"]]["notice_post_id"] is None
    # 눌러도 열리지 않을 공지는 연계가 없는 것처럼 내려준다. 화살표만 남으면 안 된다.
    assert events[ids["to_hidden"]]["notice_post_id"] is None
    assert events[ids["to_removed"]]["notice_post_id"] is None


def test_event_write_api_never_touches_the_notice_link(api) -> None:
    """관리자가 DB에서 직접 넣는 값이라, 앱에서 일정을 고쳐도 지워지면 안 된다."""

    ids = _setup(api)
    payload = {
        "title": "제목만 고친다",
        "category": "academic",
        "start_at": "2026-12-01T09:00:00",
    }
    updated = api.client.put(f"/api/events/{ids['linked']}", headers=api.headers["admin"], json=payload)
    assert updated.status_code == 200
    assert updated.json()["data"]["notice_post_id"] == ids["published"]

    with api.session() as db:
        assert db.get(Event, ids["linked"]).notice_post_id == ids["published"]


def test_event_create_ignores_a_client_supplied_notice_link(api) -> None:
    ids = _setup(api)
    created = api.client.post("/api/events", headers=api.headers["admin"], json={
        "title": "새 일정",
        "category": "academic",
        "start_at": "2026-12-02T09:00:00",
        "notice_post_id": ids["published"],
    })
    assert created.status_code == 200
    assert created.json()["data"]["notice_post_id"] is None


@pytest.mark.parametrize("event_key,expected", [("linked", "published"), ("plain", None), ("to_hidden", None)])
def test_notifications_resolve_the_link_when_read(api, event_key, expected) -> None:
    """알림에 박아두지 않고 읽을 때 찾으므로, 발송 뒤에 연결해도 그 공지로 간다."""

    ids = _setup(api)
    with api.session() as db:
        db.add(Notification(
            user_id=3,
            notification_type="event",
            message="일정이 곧 시작해요",
            event_id=ids[event_key],
        ))
        db.commit()

    response = api.client.get("/api/notifications", headers=api.headers["admin"])
    assert response.status_code == 200
    row = next(item for item in response.json()["data"] if item["event_id"] == ids[event_key])
    assert row["event_notice_post_id"] == (ids[expected] if expected else None)


def test_a_link_added_after_the_notification_still_opens(api) -> None:
    ids = _setup(api)
    with api.session() as db:
        db.add(Notification(
            user_id=3,
            notification_type="event",
            message="일정이 곧 시작해요",
            event_id=ids["plain"],
        ))
        db.commit()

    before = api.client.get("/api/notifications", headers=api.headers["admin"]).json()["data"]
    assert next(i for i in before if i["event_id"] == ids["plain"])["event_notice_post_id"] is None

    with api.session() as db:
        db.get(Event, ids["plain"]).notice_post_id = ids["published"]
        db.commit()

    after = api.client.get("/api/notifications", headers=api.headers["admin"]).json()["data"]
    assert next(i for i in after if i["event_id"] == ids["plain"])["event_notice_post_id"] == ids["published"]
