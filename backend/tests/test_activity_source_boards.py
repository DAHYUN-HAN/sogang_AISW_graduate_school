"""동아리 말고 스터디·네트워킹 활동인증도 활동 대상을 서버가 확인한다.

목록에서 숨기는 것만으로는 옛 앱이나 직접 호출을 막지 못한다.
"""

from datetime import datetime

import pytest

from app.models.board import Board
from app.models.post import Post
from app.models.student_roster import StudentRosterMember


CASES = [
    ("study-activity", "study-recruit", "user"),
    ("networking-activity", "networking-programs", "admin"),
]


def _setup(api, activity_slug: str, source_slug: str, source_write: str) -> dict[str, int]:
    with api.session() as db:
        payer = StudentRosterMember(name="Payer", major="AI", student_number="A74002")
        source_board = Board(
            name=source_slug,
            slug=source_slug,
            category="participation",
            board_type="post",
            read_permission="user",
            write_permission=source_write,
        )
        activity_board = Board(
            name=activity_slug,
            slug=activity_slug,
            category="participation",
            board_type="activity_certification",
            read_permission="user",
            write_permission="user",
        )
        other_board = Board(
            name="other",
            slug=f"{activity_slug}-other",
            category="community",
            board_type="post",
            read_permission="user",
            write_permission="user",
        )
        db.add_all([payer, source_board, activity_board, other_board])
        db.flush()

        live = Post(board_id=source_board.id, author_id=3, title="운영 중", content="c", status="published")
        ended = Post(
            board_id=source_board.id,
            author_id=3,
            title="운영 종료",
            content="c",
            status="published",
            metadata_json={"operation_status": "ended"},
        )
        deleted = Post(
            board_id=source_board.id,
            author_id=3,
            title="지워진 대상",
            content="c",
            status="published",
            deleted_at=datetime.utcnow(),
        )
        wrong = Post(board_id=other_board.id, author_id=3, title="다른 게시판", content="c", status="published")
        db.add_all([live, ended, deleted, wrong])
        db.commit()
        return {
            "payer": payer.id,
            "source_board": source_board.id,
            "activity_board": activity_board.id,
            "live": live.id,
            "ended": ended.id,
            "deleted": deleted.id,
            "wrong": wrong.id,
            "other_board": other_board.id,
        }


def _payload(payer_id: int, source_id: object = None) -> dict:
    metadata: dict[str, object] = {
        "activity_date": "2026.08.14",
        "participant_dues_payer_ids": [payer_id],
        "bank_account": "Sogang 123",
    }
    if source_id is not None:
        metadata["activity_source_post_id"] = source_id
    return {
        "title": "활동 인증",
        "content": "내용",
        "category": "클라이언트가 보낸 분류",
        "metadata": metadata,
        "attachment_ids": [1],
        "is_anonymous": False,
    }


def _create(api, ids: dict, source_key: object):
    source_id = str(ids[source_key]) if isinstance(source_key, str) and source_key in ids else source_key
    return api.client.post(
        f"/api/boards/{ids['activity_board']}/posts",
        headers=api.headers["owner"],
        json=_payload(ids["payer"], source_id),
    )


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_live_source_is_accepted(api, activity_slug, source_slug, source_write) -> None:
    ids = _setup(api, activity_slug, source_slug, source_write)
    response = _create(api, ids, "live")
    assert response.status_code == 200
    with api.session() as db:
        post = db.get(Post, response.json()["data"]["id"])
        assert post.metadata_json["activity_source_post_id"] == str(ids["live"])
        # 분류를 대상 제목으로 덮어쓰는 것은 아직 동아리만 한다.
        assert post.category == "클라이언트가 보낸 분류"


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
@pytest.mark.parametrize("bad", ["ended", "deleted", "wrong"])
def test_unselectable_sources_are_rejected(api, activity_slug, source_slug, source_write, bad) -> None:
    ids = _setup(api, activity_slug, source_slug, source_write)
    response = _create(api, ids, bad)
    assert response.status_code == 422, f"{activity_slug}/{bad}"
    assert response.json()["code"] == "INVALID_ACTIVITY_SOURCE"


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_missing_source_is_rejected_on_create(api, activity_slug, source_slug, source_write) -> None:
    ids = _setup(api, activity_slug, source_slug, source_write)
    assert _create(api, ids, None).status_code == 422


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_legacy_post_without_a_source_stays_editable(api, activity_slug, source_slug, source_write) -> None:
    """검증이 없던 시절 대상 없이 올라온 글까지 수정이 막히면 안 된다."""

    ids = _setup(api, activity_slug, source_slug, source_write)
    created = _create(api, ids, "live")
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]
    with api.session() as db:
        post = db.get(Post, post_id)
        metadata = dict(post.metadata_json)
        metadata.pop("activity_source_post_id")
        post.metadata_json = metadata
        db.commit()

    payload = _payload(ids["payer"])
    payload["content"] = "오타 수정"
    edited = api.client.put(f"/api/posts/{post_id}", headers=api.headers["owner"], json=payload)
    assert edited.status_code == 200


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_source_that_ended_later_still_allows_editing_old_posts(api, activity_slug, source_slug, source_write) -> None:
    ids = _setup(api, activity_slug, source_slug, source_write)
    created = _create(api, ids, "live")
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    with api.session() as db:
        source = db.get(Post, ids["live"])
        source.metadata_json = {"operation_status": "ended"}
        db.commit()

    payload = _payload(ids["payer"], str(ids["live"]))
    payload["content"] = "지난 활동 내용 보정"
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["owner"], json=payload).status_code == 200
    # 새로 쓰는 것은 그 시점부터 막힌다.
    assert _create(api, ids, "live").status_code == 422


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_operation_status_survives_an_edit_that_does_not_send_it(api, activity_slug, source_slug, source_write) -> None:
    """운영 상태는 관리자가 DB에서 직접 넣는다. 앱은 이 키를 모르고 보내지 않으므로
    이어받지 않으면 글을 한 번 고치는 것만으로 지워진다."""

    ids = _setup(api, activity_slug, source_slug, source_write)
    with api.session() as db:
        source = db.get(Post, ids["live"])
        source.metadata_json = {**(source.metadata_json or {}), "operation_status": "ended"}
        db.commit()

    edited = api.client.put(f"/api/posts/{ids['live']}", headers=api.headers["admin"], json={
        "title": "운영 중",
        "content": "오타만 고친다",
        "attachment_ids": [1],
        "metadata": {"application_url": "https://example.com/join"},
    })
    assert edited.status_code == 200
    with api.session() as db:
        assert db.get(Post, ids["live"]).metadata_json["operation_status"] == "ended"
    # 유지됐으니 새 활동인증은 계속 막힌다.
    assert _create(api, ids, "live").status_code == 422


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_list_filters_by_operation_status_on_the_server(api, activity_slug, source_slug, source_write) -> None:
    """목록을 서버가 걸러야 운영이 끝난 대상이 페이지를 차지하지 않는다."""

    ids = _setup(api, activity_slug, source_slug, source_write)
    with api.session() as db:
        extra_ended = Post(
            board_id=ids["source_board"],
            author_id=3,
            title="운영 종료 추가",
            content="c",
            status="published",
            metadata_json={"operation_status": "ended"},
        )
        db.add(extra_ended)
        db.commit()
        extra_ended_id = extra_ended.id

    def _ids(**params):
        response = api.client.get(
            f"/api/boards/{ids['source_board']}/posts",
            headers=api.headers["owner"],
            params={"page": 1, "size": 50, "status": "published", **params},
        )
        assert response.status_code == 200
        return {post["id"] for post in response.json()["data"]}

    # 필터가 없으면 지금까지처럼 전부 보인다. 안내 목록은 종료된 대상도 읽을 수 있어야 한다.
    everything = _ids()
    assert {ids["live"], ids["ended"], extra_ended_id} <= everything

    active = _ids(operation_status="active")
    assert ids["live"] in active
    assert ids["ended"] not in active
    assert extra_ended_id not in active

    ended = _ids(operation_status="ended")
    assert ended == {ids["ended"], extra_ended_id}


def test_old_status_key_does_not_control_source_selection_or_filter(api) -> None:
    ids = _setup(api, "study-activity", "study-recruit", "user")
    with api.session() as db:
        source = db.get(Post, ids["live"])
        source.metadata_json = {"club_operation_status": "ended"}
        db.commit()

    assert _create(api, ids, "live").status_code == 200
    response = api.client.get(
        f"/api/boards/{ids['source_board']}/posts",
        headers=api.headers["owner"],
        params={"operation_status": "active"},
    )
    assert response.status_code == 200
    assert ids["live"] in {post["id"] for post in response.json()["data"]}


def test_list_rejects_an_unknown_operation_status(api) -> None:
    ids = _setup(api, "study-activity", "study-recruit", "user")
    response = api.client.get(
        f"/api/boards/{ids['source_board']}/posts",
        headers=api.headers["owner"],
        params={"operation_status": "closed"},
    )
    assert response.status_code == 422


@pytest.mark.parametrize(("activity_slug", "source_slug", "source_write"), CASES)
def test_a_post_cannot_be_moved_into_an_activity_board(api, activity_slug, source_slug, source_write) -> None:
    """활동인증 게시판으로 글을 옮기는 것 자체가 막혀 있다.

    대상 없는 활동인증이 이 경로로 생길 수 없다는 뜻이다. 이동 제한이 풀리더라도
    _canonical_activity_source가 옮겨 온 글을 새 글로 보게 해 두었다.
    """

    ids = _setup(api, activity_slug, source_slug, source_write)
    created = api.client.post(
        f"/api/boards/{ids['other_board']}/posts",
        headers=api.headers["owner"],
        json={"title": "원래 다른 게시판 글", "content": "내용", "attachment_ids": [1], "is_anonymous": False},
    )
    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    moved = api.client.put(
        f"/api/posts/{post_id}",
        headers=api.headers["owner"],
        json={**_payload(ids["payer"]), "board_id": ids["activity_board"]},
    )
    assert moved.status_code == 400
    assert "resource boards" in moved.json()["message"]


def test_admin_networking_operation_changes_control_new_certifications(api) -> None:
    ids = _setup(api, "networking-activity", "networking-programs", "admin")
    guide_payload = {
        "title": "네트워킹 행사", "content": "행사 안내", "attachment_ids": [1],
        "metadata": {"application_url": "https://example.com/join", "operation_status": "active"},
    }
    saved = api.client.put(f"/api/posts/{ids['live']}", headers=api.headers["admin"], json=guide_payload)
    assert saved.status_code == 200
    created = _create(api, ids, "live")
    assert created.status_code == 200
    certification_id = created.json()["data"]["id"]

    ended_payload = {**guide_payload, "metadata": {**guide_payload["metadata"], "operation_status": "ended"}}
    denied = api.client.put(f"/api/posts/{ids['live']}", headers=api.headers["owner"], json=ended_payload)
    assert denied.status_code == 403
    ended = api.client.put(f"/api/posts/{ids['live']}", headers=api.headers["admin"], json=ended_payload)
    assert ended.status_code == 200
    rejected = _create(api, ids, "live")
    assert rejected.status_code == 422
    assert rejected.json()["code"] == "INVALID_ACTIVITY_SOURCE"

    historical_edit = api.client.put(
        f"/api/posts/{certification_id}", headers=api.headers["owner"],
        json={**_payload(ids["payer"], str(ids["live"])), "content": "기존 인증 수정"},
    )
    assert historical_edit.status_code == 200
    resumed = api.client.put(f"/api/posts/{ids['live']}", headers=api.headers["admin"], json=guide_payload)
    assert resumed.status_code == 200
    assert _create(api, ids, "live").status_code == 200
