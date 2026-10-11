from datetime import datetime, timedelta, timezone

from app.models.poll import PollQuestion
from test_notice_polls import draft, editable, setup, vote


def iso(delta):
    return (datetime.now(timezone.utc) + delta).isoformat()


def card(title="참석", ends_at=None, **patch):
    return {"title": title, "kind": "text", "allow_multiple": False, "ends_at": ends_at,
            "options": [{"label": "참석"}, {"label": "불참"}], **patch}


def save(api, post_id, poll, questions):
    return api.client.put(f"/api/posts/{post_id}", headers=api.headers["admin"],
                          json={"title": "행사 안내", "content": "본문 보존",
                                "poll": {**editable(poll), "questions": questions}})


def latest(api, post_id):
    return api.client.get(f"/api/posts/{post_id}/poll", headers=api.headers["owner"]).json()["data"]


def expire(api, question_id, *, seconds=1):
    with api.session() as db:
        db.get(PollQuestion, question_id).ends_at = datetime.utcnow() - timedelta(seconds=seconds)
        db.commit()


def test_each_card_keeps_its_own_optional_deadline(api):
    _, post_id, poll = setup(api, draft(questions=[card("1부", iso(timedelta(days=1))), card("2부")]))
    first, second = poll["questions"]
    assert first["ends_at"] is not None and first["is_closed"] is False and first["closed_at"] is None
    assert second["ends_at"] is None
    assert vote(api, post_id, poll).status_code == 200


def test_past_deadline_is_rejected_on_save(api):
    _, post_id, poll = setup(api)
    response = save(api, post_id, poll, [{**editable(poll)["questions"][0], "ends_at": iso(-timedelta(minutes=1))}])
    assert response.status_code == 422
    assert response.json()["code"] == "POLL_DEADLINE_PAST"
    assert latest(api, post_id)["questions"][0]["ends_at"] is None


def test_passed_deadline_closes_card_at_that_moment_and_blocks_vote_and_withdrawal(api):
    _, post_id, poll = setup(api, draft(questions=[card("1부", iso(timedelta(days=1))), card("2부")]))
    first, second = poll["questions"]
    assert vote(api, post_id, poll).status_code == 200
    expire(api, first["id"])
    data = latest(api, post_id)
    closed_card = data["questions"][0]
    assert closed_card["is_closed"] is True
    assert closed_card["closed_at"] == closed_card["ends_at"]
    assert data["questions"][1]["is_closed"] is False and data["is_closed"] is False
    for options in ([first["options"][1]["id"]], []):
        response = api.client.put(f"/api/posts/{post_id}/poll/vote", headers=api.headers["owner"],
                                  json={"revision": poll["revision"], "answers": [{"question_id": first["id"], "option_ids": options}]})
        assert response.json()["code"] == "POLL_CLOSED"
    # The other card is unaffected.
    response = api.client.put(f"/api/posts/{post_id}/poll/vote", headers=api.headers["owner"],
                              json={"revision": poll["revision"], "answers": [{"question_id": second["id"], "option_ids": []}]})
    assert response.status_code == 200


def test_admin_close_before_deadline_records_the_actual_time(api):
    _, post_id, poll = setup(api, draft(questions=[card(ends_at=iso(timedelta(days=3)))]))
    closed = api.client.post(f"/api/posts/{post_id}/poll/close", headers=api.headers["admin"]).json()["data"]["questions"][0]
    assert closed["is_closed"] is True
    assert closed["closed_at"] < closed["ends_at"]


def test_close_after_deadline_keeps_deadline_as_close_time(api):
    _, post_id, poll = setup(api, draft(questions=[card(ends_at=iso(timedelta(days=1)))]))
    expire(api, poll["questions"][0]["id"], seconds=60)
    closed = api.client.post(f"/api/posts/{post_id}/poll/close", headers=api.headers["admin"]).json()["data"]["questions"][0]
    assert closed["closed_at"] == closed["ends_at"]


def test_deadline_stays_editable_after_votes_without_invalidating_voters(api):
    _, post_id, poll = setup(api, draft(questions=[card(ends_at=iso(timedelta(days=1)))]))
    assert vote(api, post_id, poll).status_code == 200
    question = editable(latest(api, post_id))["questions"][0]
    extended = iso(timedelta(days=5))
    assert save(api, post_id, poll, [{**question, "ends_at": extended}]).status_code == 200
    data = latest(api, post_id)
    assert data["revision"] == poll["revision"]
    assert data["questions"][0]["ends_at"].startswith(extended[:16])
    assert vote(api, post_id, poll, "other").status_code == 200
    # Clearing returns the card to manual closing.
    assert save(api, post_id, poll, [{**question, "ends_at": None}]).status_code == 200
    assert latest(api, post_id)["questions"][0]["ends_at"] is None
    assert save(api, post_id, poll, [{**question, "ends_at": iso(-timedelta(minutes=1))}]).json()["code"] == "POLL_DEADLINE_PAST"


def test_closed_card_deadline_cannot_change(api):
    _, post_id, poll = setup(api, draft(questions=[card(ends_at=iso(timedelta(days=1)))]))
    expire(api, poll["questions"][0]["id"])
    question = editable(latest(api, post_id))["questions"][0]
    # Resending the stored value is accepted; changing it is not.
    assert save(api, post_id, poll, [question]).status_code == 200
    response = save(api, post_id, poll, [{**question, "ends_at": iso(timedelta(days=2))}])
    assert response.status_code == 409
    assert response.json()["code"] == "POLL_CLOSED"


def test_admin_summary_counts_passed_deadline_as_closed(api):
    board, post_id, poll = setup(api, draft(questions=[card("1부", iso(timedelta(days=1))), card("2부")]))
    expire(api, poll["questions"][0]["id"])
    rows = {row["id"]: row for row in api.client.get(f"/api/posts/admin/all?board_id={board}", headers=api.headers["admin"]).json()["data"]}
    assert rows[post_id]["poll_summary"]["open_count"] == 1
    assert rows[post_id]["poll_summary"]["closed_count"] == 1
