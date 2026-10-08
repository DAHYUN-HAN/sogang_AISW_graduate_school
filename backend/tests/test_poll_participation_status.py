from app.models.board import Board
from app.models.post import Post
from app.models.user import User
from test_attendance_polls import choose, settings
from test_notice_polls import setup


def status_url(post, poll, index=0):
    return f"/api/posts/{post}/poll/participants?question_id={poll['questions'][index]['id']}&participation=not_voted"


def test_nonparticipants_are_question_scoped_eligible_members_with_minimal_profiles(api):
    _, post, poll = setup(api, settings())
    assert choose(api, post, poll).status_code == 200
    response = api.client.get(status_url(post, poll), headers=api.headers["owner"])
    assert response.status_code == 200
    data = response.json()
    assert data["pagination"]["total"] == 2
    assert {member["user_id"] for member in data["data"]} == {2, 3}
    assert all(set(member) == {"user_id", "nickname", "cohort", "answers"} and member["answers"] == [] for member in data["data"])
    other_card = api.client.get(status_url(post, poll, 1), headers=api.headers["owner"]).json()
    assert {member["user_id"] for member in other_card["data"]} == {1, 2, 3}
    page = api.client.get(status_url(post, poll) + "&size=1&page=2", headers=api.headers["owner"]).json()
    assert page["pagination"]["total_pages"] == 2 and len(page["data"]) == 1
    with api.session() as db:
        db.get(User, 2).is_active = False
        db.commit()
    assert api.client.get(status_url(post, poll), headers=api.headers["owner"]).json()["pagination"]["total"] == 1


def test_nonparticipant_audience_follows_board_and_post_visibility(api):
    board, post, poll = setup(api)
    with api.session() as db:
        db.get(Board, board).read_permission = "admin"
        db.commit()
    url = status_url(post, poll)
    assert api.client.get(url, headers=api.headers["owner"]).status_code == 404
    assert {p["user_id"] for p in api.client.get(url, headers=api.headers["admin"]).json()["data"]} == {3}
    with api.session() as db:
        db.get(Board, board).read_permission = "user"
        db.get(Post, post).status = "hidden"
        db.commit()
    assert api.client.get(url, headers=api.headers["owner"]).status_code == 404
    assert {p["user_id"] for p in api.client.get(url, headers=api.headers["admin"]).json()["data"]} == {3}


def test_nonparticipant_filters_do_not_allow_unknown_cards_options_or_guests(api):
    _, post, poll = setup(api)
    base = f"/api/posts/{post}/poll/participants"
    option = poll["questions"][0]["options"][0]["id"]
    assert api.client.get(status_url(post, poll)).status_code == 401
    for query in ["participation=not_voted", "question_id=99999&participation=not_voted",
                  f"question_id={poll['questions'][0]['id']}&participation=not_voted&option_id={option}",
                  "participation=unknown"]:
        assert api.client.get(base + "?" + query, headers=api.headers["owner"]).status_code == 422


def test_nonparticipant_pagination_covers_large_audience_without_duplicate_rows(api, password_hash):
    _, post, poll = setup(api)
    with api.session() as db:
        for i in range(24):
            db.add(User(username=f"poll-eligible-{i}", email=f"poll-eligible-{i}@example.invalid",
                        nickname=f"검증 원우 {i:02}", cohort="74", password_hash=password_hash))
        db.commit()
    url = status_url(post, poll)
    first = api.client.get(url, headers=api.headers["owner"]).json()
    last = api.client.get(url + "&page=2", headers=api.headers["owner"]).json()
    assert first["pagination"]["total"] == 27
    assert len(first["data"]) == 20 and len(last["data"]) == 7
    assert len({p["user_id"] for p in first["data"] + last["data"]}) == 27
