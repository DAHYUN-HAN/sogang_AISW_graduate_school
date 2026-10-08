from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.board import Board
from app.models.media import MediaAsset
from app.models.post import Post


def draft(**patch):
    return {"questions": [{"title": "모임 장소", "kind": "text", "allow_multiple": False,
                            "options": [{"label": "학교"}, {"label": "식당"}]}], **patch}


def setup(api, poll=None, *, board_type="notice"):
    with api.session() as db:
        board = Board(name="투표 공지", slug=f"poll-{board_type}", category="notices",
                      board_type=board_type, read_permission="user", write_permission="user")
        db.add(board)
        db.commit()
        board_id = board.id
    response = api.client.post(f"/api/boards/{board_id}/posts", headers=api.headers["admin"],
                               json={"title": "행사 안내", "content": "본문 보존", "poll": poll or draft(),
                                     "metadata": {"show_in_council_activity": False}})
    assert response.status_code == 200, response.text
    post_id = response.json()["data"]["id"]
    response = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"])
    assert response.status_code == 200, response.text
    return board_id, post_id, response.json()["data"]


def vote(api, post_id, poll, user="owner", options=None):
    answers = [{"question_id": q["id"], "option_ids": options or [q["options"][0]["id"]]}
               for q in poll["questions"]]
    return api.client.put(f"/api/posts/{post_id}/poll/vote", headers=api.headers[user],
                          json={"revision": poll["revision"], "answers": answers})


def editable(poll):
    return {"revision": poll["revision"], "ends_at": poll["ends_at"],
            "questions": [{"id": q["id"], "title": q["title"], "kind": q["kind"],
                           "allow_multiple": q["allow_multiple"],
                           "options": [{"id": o["id"], "label": o["label"], "media_id": o["media_id"]}
                                       for o in q["options"]]} for q in poll["questions"]]}


def test_notice_poll_creation_and_named_revote(api):
    _, post_id, poll = setup(api)
    detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"]).json()["data"]
    assert detail["poll"]["id"] == poll["id"]
    assert vote(api, post_id, poll).status_code == 200
    assert vote(api, post_id, poll).status_code == 200
    assert vote(api, post_id, poll, "other").status_code == 200
    q = poll["questions"][0]
    assert vote(api, post_id, poll, options=[q["options"][1]["id"]]).status_code == 200
    data = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]
    assert data["participant_count"] == 2
    assert [o["vote_count"] for o in data["questions"][0]["options"]] == [1, 1]
    assert data["my_answers"][0]["option_ids"] == [q["options"][1]["id"]]
    people = api.client.get(f"/api/posts/{post_id}/poll/participants", headers=api.headers["owner"])
    assert people.status_code == 200
    assert {p["user_id"] for p in people.json()["data"]} == {1, 2}
    assert all(set(p) == {"user_id", "nickname", "cohort", "answers"} for p in people.json()["data"])
    filtered = api.client.get(f"/api/posts/{post_id}/poll/participants?option_id={q['options'][1]['id']}",
                              headers=api.headers["other"])
    assert [p["user_id"] for p in filtered.json()["data"]] == [1]


def test_poll_settings_are_explicit_admin_only_and_notice_only(api):
    board_id, post_id, poll = setup(api)
    response = api.client.post(f"/api/boards/{board_id}/posts", headers=api.headers["owner"],
                               json={"title": "unauthorized", "content": "x", "poll": draft()})
    assert response.status_code == 403
    response = api.client.put(f"/api/posts/{post_id}", headers=api.headers["owner"],
                              json={"title": "x", "content": "x", "poll": editable(poll)})
    assert response.status_code == 403
    assert api.client.post(f"/api/posts/{post_id}/poll/close", headers=api.headers["owner"]).status_code == 403
    response = api.client.post("/api/boards/2/posts", headers=api.headers["admin"],
                               json={"title": "x", "content": "x", "poll": draft()})
    assert response.status_code == 422
    assert response.json()["code"] == "POLL_NOTICE_ONLY"
    assert api.client.get(f"/api/posts/{post_id}/poll").status_code == 401


def test_existing_clients_preserve_poll_and_votes_when_editing_body(api):
    _, post_id, poll = setup(api)
    assert vote(api, post_id, poll).status_code == 200
    response = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                              json={"title": "변경", "content": "새 본문"})
    assert response.status_code == 200
    current = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]
    assert current["id"] == poll["id"]
    assert current["revision"] == poll["revision"]
    assert current["participant_count"] == 1


def test_admin_can_move_polled_notice_only_to_another_notice(api):
    _, post_id, poll = setup(api)
    assert vote(api, post_id, poll).status_code == 200
    with api.session() as db:
        target = Board(name="다른 공지", slug="poll-target", category="notices", board_type="notice",
                       read_permission="user", write_permission="admin")
        db.add(target)
        db.commit()
        target_id = target.id
    moved = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                           json={"board_id": target_id, "title": "이동 공지", "content": "본문"})
    assert moved.status_code == 200, moved.text
    current = api.client.get(f"/api/posts/{post_id}", headers=api.headers["owner"]).json()["data"]
    assert current["board_id"] == target_id
    assert current["poll"]["id"] == poll["id"]
    assert current["poll"]["participant_count"] == 1
    rejected = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                              json={"board_id": 2, "title": "일반 글", "content": "본문"})
    assert rejected.status_code == 400
    with api.session() as db:
        assert db.get(Post, post_id).board_id == target_id


def test_vote_validation_and_stale_revision_do_not_create_votes(api):
    _, post_id, poll = setup(api)
    q = poll["questions"][0]
    for choices in [[o["id"] for o in q["options"]], [999999], [q["options"][0]["id"]] * 2]:
        assert vote(api, post_id, poll, options=choices).status_code == 422
    assert api.client.put(f"/api/posts/{post_id}/poll/vote", headers=api.headers["owner"],
                          json={"revision": poll["revision"], "answers": []}).status_code == 422
    stale = {**poll, "revision": poll["revision"] + 1}
    assert vote(api, post_id, stale).status_code == 409
    assert api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]["participant_count"] == 0


def test_structure_freezes_after_first_vote_and_rejected_save_is_atomic(api):
    _, post_id, poll = setup(api)
    assert vote(api, post_id, poll).status_code == 200
    settings = editable(poll)
    settings["questions"][0]["options"][0]["label"] = "다른 장소"
    response = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                              json={"title": "변경되면 안 됨", "content": "x", "poll": settings})
    assert response.status_code == 409
    assert response.json()["code"] == "POLL_HAS_VOTES"
    with api.session() as db:
        assert db.get(Post, post_id).title == "행사 안내"
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "x", "content": "x", "poll": None}).status_code == 409


def test_manual_close_is_idempotent_and_retains_results(api):
    _, post_id, poll = setup(api)
    from app.models.poll import PostPoll
    assert vote(api, post_id, poll).status_code == 200
    first = api.client.post(f"/api/posts/{post_id}/poll/close", headers=api.headers["admin"])
    again = api.client.post(f"/api/posts/{post_id}/poll/close", headers=api.headers["admin"])
    assert first.status_code == again.status_code == 200
    assert first.json()["data"]["closed_at"] == again.json()["data"]["closed_at"]
    assert vote(api, post_id, poll, "other").status_code == 409
    with api.session() as db:
        stored = db.scalar(select(PostPoll).where(PostPoll.post_id == post_id))
        stored.closed_at = None
        stored.ends_at = datetime.utcnow() - timedelta(seconds=1)
        db.commit()
    assert vote(api, post_id, poll, "other").json()["code"] == "POLL_CLOSED"


def test_legacy_date_and_multiple_choice_results_survive_unchanged_save(api):
    from app.models.poll import PollOption, PollQuestion, PollSelection, PollBallot
    _, post_id, poll = setup(api)
    assert vote(api, post_id, poll).status_code == 200
    with api.session() as db:
        question = db.get(PollQuestion, poll["questions"][0]["id"])
        question.kind, question.allow_multiple = "date", True
        options = [db.get(PollOption, o["id"]) for o in poll["questions"][0]["options"]]
        options[0].label, options[1].label = "2026-10-15", "2026-10-16"
        ballot = db.scalar(select(PollBallot).where(PollBallot.poll_id == poll["id"]))
        db.add(PollSelection(ballot_id=ballot.id, option_id=options[1].id))
        db.commit()
    current = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]
    assert current["questions"][0]["legacy"] is True
    assert [o["vote_count"] for o in current["questions"][0]["options"]] == [1, 1]
    assert vote(api, post_id, current).json()["code"] == "POLL_LEGACY_READ_ONLY"
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "행사 안내", "content": "새 본문", "poll": editable(current)}).status_code == 200
    assert api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"] == current


def test_hidden_notice_blocks_member_poll_and_media_access(api):
    with api.session() as db:
        image = MediaAsset(owner_id=3, original_filename="poll.png", stored_filename="poll.png",
                           content_type="image/png", file_size=20, status="ready")
        db.add(image)
        db.commit()
        image_id = image.id
    _, post_id, poll = setup(api)
    from app.models.poll import PollOption
    with api.session() as db:
        db.get(PollOption, poll["questions"][0]["options"][0]["id"]).media_id = image_id
        db.commit()
    from app.media_service import require_media_access
    from app.models.user import User
    from app.errors import AppException
    with api.session() as db:
        assert require_media_access(db, db.get(MediaAsset, image_id), db.get(User, 1)).id == image_id
        db.get(Post, post_id).status = "hidden"
        db.commit()
        with pytest.raises(AppException):
            require_media_access(db, db.get(MediaAsset, image_id), db.get(User, 1))
    assert api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).status_code == 404
    assert vote(api, post_id, poll).status_code == 404


def test_account_deletion_removes_votes_but_keeps_poll_image_and_lock(api):
    from conftest import TEST_PASSWORD
    with api.session() as db:
        image = MediaAsset(owner_id=1, original_filename="poll-retain.png", stored_filename="poll-retain.png",
                           content_type="image/png", file_size=20, status="ready")
        db.add(image)
        db.commit()
        image_id = image.id
    _, post_id, poll = setup(api)
    from app.models.poll import PostPoll, PollOption
    assert vote(api, post_id, poll).status_code == 200
    with api.session() as db:
        db.get(PollOption, poll["questions"][0]["options"][0]["id"]).media_id = image_id
        db.commit()
    deleted = api.client.request("DELETE", "/api/users/me", headers=api.headers["owner"],
                                 json={"current_password": TEST_PASSWORD})
    assert deleted.status_code == 200, deleted.text
    current = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["other"]).json()["data"]
    assert current["participant_count"] == 0
    assert current["locked"] is True
    with api.session() as db:
        assert db.get(MediaAsset, image_id).owner_id is None
        assert db.scalar(select(PostPoll).where(PostPoll.post_id == post_id)).first_voted_at is not None


def test_settings_revision_foreign_ids_and_invalid_media_roll_back(api):
    board_id, post_id, poll = setup(api)
    settings = editable(poll)
    settings["questions"][0]["title"] = "수정 질문"
    response = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                              json={"title": "공지", "content": "본문", "poll": settings})
    assert response.status_code == 200
    assert vote(api, post_id, poll).json()["code"] == "POLL_CHANGED"
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "오래된 수정", "content": "본문", "poll": settings}).json()["code"] == "POLL_CHANGED"
    current = api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]
    invalid = editable(current)
    invalid["questions"][0]["options"][0]["id"] = 999999
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "오류", "content": "본문", "poll": invalid}).status_code == 422
    for content_type, status, private in [("application/pdf", "ready", False), ("image/png", "pending", False), ("image/png", "ready", True)]:
        with api.session() as db:
            media = MediaAsset(owner_id=3, original_filename="invalid", stored_filename=f"{status}-{private}-{content_type[-3:]}",
                               content_type=content_type, file_size=20, status=status, is_private=private)
            db.add(media)
            db.commit()
            media_id = media.id
        invalid = draft()
        invalid["questions"][0]["options"][0]["media_id"] = media_id
        result = api.client.post(f"/api/boards/{board_id}/posts", headers=api.headers["admin"],
                                 json={"title": "거절되어야 함", "content": "본문", "poll": invalid})
        assert result.status_code == 422
        assert result.json()["code"] == "VALIDATION_ERROR"
    with api.session() as db:
        assert db.scalar(select(Post.id).where(Post.title == "거절되어야 함")) is None


def test_participants_pagination_profiles_and_foreign_filter(api):
    _, post_id, poll = setup(api)
    assert vote(api, post_id, poll).status_code == vote(api, post_id, poll, "other").status_code == 200
    from app.models.user import User
    with api.session() as db:
        db.get(User, 1).nickname = "현재 이름"
        db.commit()
    first = api.client.get(f"/api/posts/{post_id}/poll/participants?size=1", headers=api.headers["owner"]).json()
    second = api.client.get(f"/api/posts/{post_id}/poll/participants?size=1&page=2", headers=api.headers["owner"]).json()
    assert first["pagination"] == {"page": 1, "size": 1, "total": 2, "total_pages": 2}
    assert {p["user_id"] for p in first["data"] + second["data"]} == {1, 2}
    assert next(p for p in first["data"] + second["data"] if p["user_id"] == 1)["nickname"] == "현재 이름"
    assert api.client.get(f"/api/posts/{post_id}/poll/participants?option_id=99999", headers=api.headers["owner"]).status_code == 422


def test_deadline_and_date_validation_and_pre_vote_removal(api):
    board_id, post_id, poll = setup(api)
    for invalid in [draft(ends_at="2026-12-01T12:00:00"), draft(ends_at="2000-01-01T00:00:00Z"),
                    {"questions": []}, {"questions": [{"title": "날짜", "kind": "date", "options": [{"label": "2026-02-30"}, {"label": "2026-02-28"}]}]}]:
        assert api.client.post(f"/api/boards/{board_id}/posts", headers=api.headers["admin"],
                               json={"title": "오류", "content": "본문", "poll": invalid}).status_code == 422
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "일반 공지", "content": "본문", "poll": None, "poll_revision": poll["revision"]}).status_code == 200
    assert api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).status_code == 404


def test_stale_removal_and_board_type_change_preserve_poll(api):
    board_id, post_id, poll = setup(api)
    settings = editable(poll)
    settings["questions"][0]["title"] = "수정 질문"
    assert api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "새 공지", "content": "본문", "poll": settings}).status_code == 200
    removal = api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                             json={"title": "오래된 삭제", "content": "본문", "poll": None, "poll_revision": poll["revision"]})
    assert removal.status_code == 409
    assert removal.json()["code"] == "POLL_CHANGED"
    changed = api.client.put(f"/api/boards/admin/{board_id}", headers=api.headers["admin"], json={"board_type": "post"})
    assert changed.status_code == 422
    assert changed.json()["code"] == "POLL_NOTICE_ONLY"
    assert api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).status_code == 200
