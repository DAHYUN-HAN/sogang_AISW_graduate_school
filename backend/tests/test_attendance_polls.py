from datetime import datetime, timedelta
from sqlalchemy import select
from app.models.poll import PostPoll
from test_notice_polls import editable, setup


def settings(count=2):
    return {"questions": [{"title": f"참석 투표 {i + 1}", "options": [{"label": "YES"}, {"label": "NO"}]} for i in range(count)]}


def choose(api, post, poll, index=0, option=0, who="owner"):
    question = poll["questions"][index]
    return api.client.put(f"/api/posts/{post}/poll/vote", headers=api.headers[who], json={"revision": poll["revision"],
        "answers": [{"question_id": question["id"], "option_ids": [question["options"][option]["id"]]}]})


def current(api, post):
    return api.client.get(f"/api/posts/{post}/poll", headers=api.headers["owner"]).json()["data"]


def test_independent_votes_revotes_counts_and_participants(api):
    _, post, poll = setup(api, settings())
    assert choose(api, post, poll).status_code == 200
    assert choose(api, post, poll, 1).status_code == 200
    assert choose(api, post, poll, 1, 1, "other").status_code == 200
    assert choose(api, post, poll, 0, 1).status_code == 200
    result = current(api, post)
    assert [q["participant_count"] for q in result["questions"]] == [1, 2]
    assert [[o["vote_count"] for o in q["options"]] for q in result["questions"]] == [[0, 1], [1, 1]]
    assert result["my_answers"] == [{"question_id": q["id"], "option_ids": [q["options"][i]["id"]]} for q, i in zip(result["questions"], [1, 0])]
    people = api.client.get(f"/api/posts/{post}/poll/participants?question_id={poll['questions'][0]['id']}", headers=api.headers["other"]).json()
    assert people["pagination"]["total"] == 1
    assert len(people["data"][0]["answers"]) == 1
    assert people["data"][0]["answers"][0]["label"] == "NO"


def test_manual_close_is_independent_and_guards_other_question_ids(api):
    _, post, poll = setup(api, settings())
    qid = poll["questions"][0]["id"]
    url = f"/api/posts/{post}/poll/close?question_id={qid}"
    assert api.client.post(url, headers=api.headers["owner"]).status_code == 403
    first = api.client.post(url, headers=api.headers["admin"])
    assert first.status_code == 200
    result = first.json()["data"]
    assert [q.get("is_closed") for q in result["questions"]] == [True, False]
    assert result["is_closed"] is False
    assert api.client.post(url, headers=api.headers["admin"]).json()["data"]["questions"][0]["closed_at"] == result["questions"][0]["closed_at"]
    assert choose(api, post, poll).json()["code"] == "POLL_CLOSED"
    assert choose(api, post, poll, 1).status_code == 200
    assert api.client.post(f"/api/posts/{post}/poll/close?question_id=99999", headers=api.headers["admin"]).status_code == 404
    assert api.client.get(f"/api/posts/{post}/poll/participants?question_id=99999", headers=api.headers["owner"]).status_code == 422
    foreign_option = poll["questions"][1]["options"][0]["id"]
    assert api.client.get(f"/api/posts/{post}/poll/participants?question_id={qid}&option_id={foreign_option}", headers=api.headers["owner"]).status_code == 422
    edit = editable(current(api, post)); edit["questions"][0]["title"] = "종료 후 수정"
    assert api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "변경", "content": "본문", "poll": edit}).json()["code"] == "POLL_CLOSED"
    assert api.client.post(f"/api/posts/{post}/poll/close", headers=api.headers["admin"]).json()["data"]["is_closed"] is True
    edit = editable(current(api, post)); edit["questions"].append(settings(1)["questions"][0])
    assert api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "행사", "content": "본문", "poll": edit}).status_code == 200
    assert [q["is_closed"] for q in current(api, post)["questions"]] == [True, True, False]


def test_new_and_changed_polls_are_exactly_two_text_single_choices_without_deadline(api):
    board, post, poll = setup(api, settings(1))
    for patch in [{"allow_multiple": True}, {"kind": "date"}, {"options": [{"label": "A"}, {"label": "B"}, {"label": "C"}]}]:
        invalid = settings(1)
        invalid["questions"][0].update(patch)
        assert api.client.post(f"/api/boards/{board}/posts", headers=api.headers["admin"], json={"title": "거절", "content": "본문", "poll": invalid}).status_code == 422
        invalid = editable(poll)
        invalid["questions"][0].update(patch)
        assert api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "거절", "content": "본문", "poll": invalid}).status_code == 422
    invalid = settings(1) | {"ends_at": "2099-10-09T00:00:00Z"}
    assert api.client.post(f"/api/boards/{board}/posts", headers=api.headers["admin"], json={"title": "거절", "content": "본문", "poll": invalid}).status_code == 422
    q = poll["questions"][0]
    assert api.client.put(f"/api/posts/{post}/poll/vote", headers=api.headers["owner"], json={"revision": poll["revision"], "answers": [{"question_id": q["id"], "option_ids": [o["id"] for o in q["options"]]}]}).status_code == 422


def test_append_and_remove_unvoted_cards_after_another_card_receives_votes(api):
    _, post, poll = setup(api, settings(2))
    assert choose(api, post, poll).status_code == 200
    edit = editable(current(api, post))
    edit["questions"].append(settings(1)["questions"][0] | {"title": "뒤풀이 참석"})
    saved = api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "행사", "content": "본문", "poll": edit})
    assert saved.status_code == 200, saved.text
    result = saved.json()["data"] if "questions" in saved.json()["data"] else current(api, post)
    assert len(result["questions"]) == 3
    assert [q["locked"] for q in result["questions"]] == [True, False, False]
    edit = editable(result)
    edit["questions"].pop(1)
    assert api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "행사", "content": "본문", "poll": edit}).status_code == 200
    assert current(api, post)["questions"][0]["options"][0]["vote_count"] == 1
    edit = editable(current(api, post)); edit["questions"].pop(0)
    assert api.client.put(f"/api/posts/{post}", headers=api.headers["admin"], json={"title": "거절", "content": "본문", "poll": edit}).status_code == 409


def test_more_than_three_independent_polls_and_old_deadline_does_not_close(api):
    _, post, poll = setup(api, settings(4))
    with api.session() as db:
        db.scalar(select(PostPoll).where(PostPoll.post_id == post)).ends_at = datetime.utcnow() - timedelta(days=1)
        db.commit()
    assert choose(api, post, poll, 3).status_code == 200
    assert current(api, post)["ends_at"] is None
