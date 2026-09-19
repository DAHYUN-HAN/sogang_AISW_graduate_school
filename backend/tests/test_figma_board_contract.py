from datetime import datetime

from app.models.board import Board
from app.models.bookmark import Bookmark
from app.models.comment import Comment
from app.models.post import Post
from app.models.user import User


def _add_resource_boards_and_posts(api) -> tuple[int, int]:
    with api.session() as db:
        owner = db.get(User, 1)
        other = db.get(User, 2)
        owner.cohort = "72"
        other.cohort = "73"

        lecture_board = Board(
            name="Lecture Reviews",
            slug="lecture-reviews",
            category="community",
            board_type="resource",
            read_permission="user",
            write_permission="user",
        )
        exam_board = Board(
            name="Exam Archive",
            slug="exam-archive",
            category="community",
            board_type="resource",
            read_permission="user",
            write_permission="user",
        )
        db.add_all([lecture_board, exam_board])
        db.flush()

        lecture_post = Post(
            board_id=lecture_board.id,
            author_id=owner.id,
            title="Lecture review visibility fixture",
            content="Lecture review content",
        )
        exam_post = Post(
            board_id=exam_board.id,
            author_id=owner.id,
            title="Exam archive visibility fixture",
            content="Exam archive content",
        )
        db.add_all([lecture_post, exam_post])
        db.flush()
        db.add(Comment(post_id=lecture_post.id, author_id=owner.id, content="Hidden lecture comment"))
        db.commit()
        return lecture_post.id, exam_post.id


def test_exam_archive_shows_author_and_allows_comments(api) -> None:
    lecture_post_id, exam_post_id = _add_resource_boards_and_posts(api)

    lecture_detail = api.client.get(f"/api/posts/{lecture_post_id}", headers=api.headers["other"])
    exam_detail = api.client.get(f"/api/posts/{exam_post_id}", headers=api.headers["other"])

    assert lecture_detail.status_code == 200
    assert (
        lecture_detail.json()["data"]["author_id"],
        lecture_detail.json()["data"]["author_nickname"],
        lecture_detail.json()["data"]["author_cohort"],
    ) == (None, "Anonymous", None)
    assert exam_detail.status_code == 200
    assert (
        exam_detail.json()["data"]["author_id"],
        exam_detail.json()["data"]["author_nickname"],
        exam_detail.json()["data"]["author_cohort"],
    ) == (1, "Owner", "72")

    lecture_create = api.client.post(
        f"/api/posts/{lecture_post_id}/comments",
        json={"content": "Must remain disabled"},
        headers=api.headers["other"],
    )
    exam_create = api.client.post(
        f"/api/posts/{exam_post_id}/comments",
        json={"content": "Exam archive comment"},
        headers=api.headers["other"],
    )

    # 강의후기는 글 작성자만 익명이고, 댓글은 다른 게시판처럼 작성자를 표시한다.
    assert lecture_create.status_code == 200
    lecture_comments = api.client.get(
        f"/api/posts/{lecture_post_id}/comments",
        headers=api.headers["other"],
    ).json()["data"]
    assert [
        (comment["content"], comment["author_nickname"]) for comment in lecture_comments
    ] == [("Hidden lecture comment", "Owner"), ("Must remain disabled", "Other")]
    assert exam_create.status_code == 200

    with api.session() as db:
        db.add(Comment(post_id=exam_post_id, author_id=None, content="Deleted author comment"))
        db.commit()

    comments = api.client.get(
        f"/api/posts/{exam_post_id}/comments",
        headers=api.headers["other"],
    )
    assert comments.status_code == 200
    comments_by_content = {item["content"]: item for item in comments.json()["data"]}
    assert comments_by_content["Exam archive comment"]["author_cohort"] == "73"
    assert comments_by_content["Deleted author comment"]["author_cohort"] is None


def test_search_returns_visible_author_cohort_and_masks_hidden_identity(api) -> None:
    lecture_post_id, exam_post_id = _add_resource_boards_and_posts(api)

    exam_result = api.client.get(
        "/api/search",
        params={"q": "Exam archive visibility"},
        headers=api.headers["other"],
    )
    lecture_result = api.client.get(
        "/api/search",
        params={"q": "Lecture review visibility"},
        headers=api.headers["other"],
    )

    assert exam_result.status_code == 200
    exam_item = next(item for item in exam_result.json()["data"] if item["id"] == exam_post_id)
    assert (exam_item["author_nickname"], exam_item["author_cohort"]) == ("Owner", "72")

    assert lecture_result.status_code == 200
    lecture_item = next(item for item in lecture_result.json()["data"] if item["id"] == lecture_post_id)
    assert (lecture_item["author_nickname"], lecture_item["author_cohort"]) == ("Anonymous", None)


def test_bookmark_activity_uses_post_creation_time(api) -> None:
    post_created_at = datetime(2026, 6, 15, 9, 30)
    bookmark_created_at = datetime(2026, 8, 2, 18, 45)
    with api.session() as db:
        post = db.get(Post, 3)
        post.created_at = post_created_at
        db.add(
            Bookmark(
                post_id=post.id,
                user_id=2,
                created_at=bookmark_created_at,
            )
        )
        db.commit()

    response = api.client.get(
        "/api/users/me/activity",
        params={"type": "bookmarks"},
        headers=api.headers["other"],
    )

    assert response.status_code == 200
    item = next(item for item in response.json()["data"] if item["post_id"] == 3)
    assert item["created_at"] == f"{post_created_at.isoformat()}Z"
    assert item["created_at"] != bookmark_created_at.isoformat()
