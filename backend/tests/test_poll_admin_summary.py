from test_attendance_polls import choose, settings
from test_notice_polls import setup


def test_admin_list_summarizes_independent_cards_and_distinct_respondents(api):
    board, post, poll = setup(api, settings(3))
    choose(api, post, poll, 0)
    choose(api, post, poll, 1)
    choose(api, post, poll, 1, who="other")
    api.client.post(f"/api/posts/{post}/poll/close?question_id={poll['questions'][0]['id']}", headers=api.headers["admin"])
    plain = api.client.post(f"/api/boards/{board}/posts", headers=api.headers["admin"],
                            json={"title": "투표 없는 공지", "content": "본문"}).json()["data"]["id"]
    response = api.client.get(f"/api/posts/admin/all?board_id={board}", headers=api.headers["admin"])
    assert response.status_code == 200
    rows = {row["id"]: row for row in response.json()["data"]}
    assert rows[post]["poll_summary"] == {"question_count": 3, "open_count": 2, "closed_count": 1, "participant_count": 2}
    assert rows[plain]["poll_summary"] is None
    assert api.client.get("/api/posts/admin/all", headers=api.headers["owner"]).status_code == 403
    assert api.client.get("/api/posts/admin/all").status_code == 401
    assert "poll_summary" not in api.client.get(f"/api/boards/{board}/posts", headers=api.headers["owner"]).json()["data"][0]


def test_admin_summary_tracks_close_all_and_respects_pagination(api):
    _, post, poll = setup(api, settings(2))
    api.client.post(f"/api/posts/{post}/poll/close", headers=api.headers["admin"])
    rows = api.client.get("/api/posts/admin/all?size=1", headers=api.headers["admin"]).json()["data"]
    assert len(rows) == 1
    assert rows[0]["poll_summary"] == {"question_count": 2, "open_count": 0, "closed_count": 2, "participant_count": 0}
