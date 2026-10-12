from app.models.board import Board


def write_and_delete(api):
    created = api.client.post("/api/boards/2/posts", json={"title": "스터디 모집", "content": "본문"}, headers=api.headers["owner"])
    post_id = created.json()["data"]["id"]
    assert api.client.delete(f"/api/posts/{post_id}", headers=api.headers["owner"]).status_code == 200
    return post_id


def detail(api, post_id, who="other"):
    return api.client.get(f"/api/posts/{post_id}", headers=api.headers[who])


# 피그마 Screen/Notice/Detail-Deleted: 지워진 글은 게시판을 알려 줘 앱이 원래 제목으로 삭제 화면을 띄운다.
def test_deleted_post_reports_its_board(api):
    response = detail(api, write_and_delete(api))
    assert response.status_code == 404
    assert response.json() == {"status": "error", "message": "Post deleted.", "code": "POST_DELETED", "data": {"board_id": 2}}


def test_missing_post_stays_plain_not_found(api):
    response = detail(api, 999_999)
    assert response.status_code == 404
    assert response.json() == {"status": "error", "message": "Post not found.", "code": "NOT_FOUND"}


def test_deleted_post_on_unreadable_board_does_not_reveal_the_board(api):
    post_id = write_and_delete(api)
    with api.session() as db:
        db.get(Board, 2).is_active = False
        db.commit()
    assert detail(api, post_id).json()["code"] == "NOT_FOUND"
    assert detail(api, post_id, "admin").json()["data"] == {"board_id": 2}
