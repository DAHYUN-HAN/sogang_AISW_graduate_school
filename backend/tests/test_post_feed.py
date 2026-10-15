from datetime import datetime, timedelta

from app.models.board import Board
from app.models.post import Post
from app.models.user_block import UserBlock


def _board(
    *,
    name: str,
    slug: str,
    category: str,
    board_type: str,
    is_active: bool = True,
) -> Board:
    return Board(
        name=name,
        slug=slug,
        category=category,
        board_type=board_type,
        read_permission="user",
        write_permission="user",
        is_active=is_active,
    )


def seed_feed_posts(api, *, scope: str, count: int) -> list[int]:
    assert scope == "resources"
    with api.session() as db:
        boards = [
            _board(
                name="Lecture Reviews Feed",
                slug="lecture-reviews-feed",
                category="resources",
                board_type="resource",
            ),
            _board(
                name="Exam Archive Feed",
                slug="exam-archive-feed",
                category="resources",
                board_type="resource",
            ),
        ]
        db.add_all(boards)
        db.flush()
        base = datetime(2026, 8, 1, 9, 0)
        posts = [
            Post(
                board_id=boards[index % len(boards)].id,
                author_id=1,
                title=f"Resource feed item {index + 1}",
                content=f"Resource feed body {index + 1}",
                created_at=base + timedelta(minutes=index),
            )
            for index in range(count)
        ]
        db.add_all(posts)
        db.flush()
        expected = [post.id for post in reversed(posts)]
        db.commit()
        return expected


def test_resource_feed_paginates_across_boards_in_one_global_order(api) -> None:
    seeded = seed_feed_posts(api, scope="resources", count=25)

    first = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "page": 1, "size": 20, "sort": "latest"},
        headers=api.headers["owner"],
    )
    second = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "page": 2, "size": 20, "sort": "latest"},
        headers=api.headers["owner"],
    )

    assert first.status_code == 200
    assert first.json()["pagination"] == {"page": 1, "size": 20, "total": 25, "total_pages": 2}
    ids = [item["id"] for item in first.json()["data"] + second.json()["data"]]
    assert ids == seeded
    assert len(ids) == len(set(ids)) == 25


def test_notice_feed_filters_academic_event_and_other(api) -> None:
    with api.session() as db:
        academic = _board(
            name="Academic Notices Feed",
            slug="academic-notices",
            category="notices",
            board_type="notice",
        )
        event = _board(
            name="Event Notices Feed",
            slug="event-notices",
            category="notices",
            board_type="notice",
        )
        other = _board(
            name="Other Notices Feed",
            slug="all-notices",
            category="notices",
            board_type="notice",
        )
        calendar = _board(
            name="Academic Calendar Feed",
            slug="academic-calendar",
            category="notices",
            board_type="calendar",
        )
        db.add_all([academic, event, other, calendar])
        db.flush()
        posts = {
            "academic": Post(
                board_id=academic.id,
                author_id=3,
                title="Academic notice",
                content="Academic body",
            ),
            "event": Post(
                board_id=event.id,
                author_id=3,
                title="Event notice",
                content="Event body",
            ),
            "other": Post(
                board_id=other.id,
                author_id=3,
                title="Other notice",
                content="Other body",
                category="other",
            ),
            "calendar": Post(
                board_id=calendar.id,
                author_id=3,
                title="Calendar entry",
                content="Calendar body",
                category="academic",
            ),
        }
        db.add_all(posts.values())
        db.flush()
        expected = {name: post.id for name, post in posts.items()}
        db.commit()

    for notice_category in ("academic", "event", "other"):
        response = api.client.get(
            "/api/posts/feed",
            params={"scope": "notices", "notice_category": notice_category},
            headers=api.headers["owner"],
        )

        assert response.status_code == 200
        assert [item["id"] for item in response.json()["data"]] == [expected[notice_category]]
        assert expected["calendar"] not in {item["id"] for item in response.json()["data"]}


def test_notice_other_filter_uses_explicit_category_before_board_fallback(api) -> None:
    with api.session() as db:
        all_notices = _board(
            name="Other Classifier All Notices",
            slug="all-notices",
            category="notices",
            board_type="notice",
        )
        academic_notices = _board(
            name="Other Classifier Academic Notices",
            slug="academic-notices",
            category="notices",
            board_type="notice",
        )
        db.add_all([all_notices, academic_notices])
        db.flush()
        cases = {
            "all_alias": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Explicit all alias",
                content="Other classifier",
                category="all",
            ),
            "general_alias": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Explicit general alias",
                content="Other classifier",
                category="GENERAL",
            ),
            "other_alias": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Explicit other alias",
                content="Other classifier",
                category="other-notice",
            ),
            "korean_all": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Korean all alias",
                content="Other classifier",
                category="전체 안내",
            ),
            "korean_other": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Korean other alias",
                content="Other classifier",
                category="기타 공지",
            ),
            "blank_fallback": Post(
                board_id=all_notices.id,
                author_id=3,
                title="Blank category fallback",
                content="Other classifier",
                category="   ",
            ),
            "null_fallback": Post(
                board_id=all_notices.id,
                author_id=3,
                title="Null category fallback",
                content="Other classifier",
                category=None,
            ),
            "conflicting_explicit": Post(
                board_id=all_notices.id,
                author_id=3,
                title="Explicit academic conflict",
                content="Other classifier",
                category="academic",
            ),
            "blank_non_other_board": Post(
                board_id=academic_notices.id,
                author_id=3,
                title="Blank academic fallback",
                content="Other classifier",
                category="",
            ),
        }
        db.add_all(cases.values())
        db.flush()
        expected_ids = {
            post.id
            for name, post in cases.items()
            if name not in {"conflicting_explicit", "blank_non_other_board"}
        }
        excluded_ids = {
            cases["conflicting_explicit"].id,
            cases["blank_non_other_board"].id,
        }
        db.commit()

    response = api.client.get(
        "/api/posts/feed",
        params={"scope": "notices", "notice_category": "other", "size": 100},
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    returned_ids = {item["id"] for item in response.json()["data"]}
    assert expected_ids <= returned_ids
    assert returned_ids.isdisjoint(excluded_ids)


def test_notice_filters_share_explicit_category_precedence_and_board_fallback(api) -> None:
    with api.session() as db:
        boards = {
            "academic": _board(
                name="Canonical Academic Notices",
                slug="academic-notices",
                category="notices",
                board_type="notice",
            ),
            "event": _board(
                name="Canonical Event Notices",
                slug="event-notices",
                category="notices",
                board_type="notice",
            ),
            "webinar": _board(
                name="Canonical Webinar Notices",
                slug="webinar-notices",
                category="notices",
                board_type="notice",
            ),
            "other": _board(
                name="Canonical All Notices",
                slug="all-notices",
                category="notices",
                board_type="notice",
            ),
        }
        db.add_all(boards.values())
        db.flush()
        cases = [
            ("event_on_academic", "academic", "event briefing", "event"),
            ("korean_event", "other", "행사 안내", "event"),
            ("webinar_alias", "other", "webinar session", "event"),
            ("special_lecture_alias", "academic", "특강 공지", "event"),
            ("academic_on_event", "event", "academic update", "academic"),
            ("korean_academic", "other", "학사 안내", "academic"),
            ("calendar_alias", "event", "calendar update", "academic"),
            ("all_alias", "academic", "all", "other"),
            ("korean_all_alias", "event", "전체 안내", "other"),
            ("other_alias", "academic", "other-notice", "other"),
            ("general_alias", "event", "GENERAL", "other"),
            ("korean_other_alias", "academic", "기타 공지", "other"),
            ("event_precedes_academic", "other", "academic event", "event"),
            ("webinar_precedes_academic", "other", "calendar webinar", "event"),
            ("academic_precedes_other", "event", "other academic", "academic"),
            ("blank_academic_fallback", "academic", "", "academic"),
            ("null_event_fallback", "event", None, "event"),
            ("whitespace_webinar_fallback", "webinar", "   ", "event"),
            ("null_other_fallback", "other", None, "other"),
            ("explicit_unknown_no_fallback", "other", "scholarship", None),
        ]
        posts_by_name = {}
        for name, board_key, category, _expected_filter in cases:
            post = Post(
                board_id=boards[board_key].id,
                author_id=3,
                title=f"Canonical classifier {name}",
                content="Canonical classifier body",
                category=category,
            )
            db.add(post)
            posts_by_name[name] = post
        db.flush()
        ids_by_name = {name: post.id for name, post in posts_by_name.items()}
        expected_by_filter = {
            notice_filter: {
                ids_by_name[name]
                for name, _board_key, _category, expected_filter in cases
                if expected_filter == notice_filter
            }
            for notice_filter in ("academic", "event", "other")
        }
        all_case_ids = set(ids_by_name.values())
        db.commit()

    unfiltered = api.client.get(
        "/api/posts/feed",
        params={"scope": "notices", "q": "Canonical classifier", "size": 100},
        headers=api.headers["owner"],
    )
    assert unfiltered.status_code == 200
    assert {item["id"] for item in unfiltered.json()["data"]} == all_case_ids

    for notice_filter, expected_ids in expected_by_filter.items():
        response = api.client.get(
            "/api/posts/feed",
            params={
                "scope": "notices",
                "notice_category": notice_filter,
                "q": "Canonical classifier",
                "size": 100,
            },
            headers=api.headers["owner"],
        )

        assert response.status_code == 200
        assert {item["id"] for item in response.json()["data"]} == expected_ids


def test_notice_feed_can_disable_pin_priority_for_home_preview(api) -> None:
    with api.session() as db:
        notice = _board(
            name="Home Notice Ordering Feed",
            slug="home-notice-ordering-feed",
            category="notices",
            board_type="notice",
        )
        db.add(notice)
        db.flush()
        old_pinned = Post(
            board_id=notice.id,
            author_id=3,
            title="Old pinned notice",
            content="Home ordering",
            is_pinned=True,
            created_at=datetime(2026, 8, 1, 9, 0),
        )
        newer = Post(
            board_id=notice.id,
            author_id=3,
            title="New notice",
            content="Home ordering",
            created_at=datetime(2026, 8, 3, 9, 0),
        )
        newest = Post(
            board_id=notice.id,
            author_id=3,
            title="Newest notice",
            content="Home ordering",
            created_at=datetime(2026, 8, 4, 9, 0),
        )
        db.add_all([old_pinned, newer, newest])
        db.flush()
        expected_home = [newest.id, newer.id]
        pinned_id = old_pinned.id
        db.commit()

    home = api.client.get(
        "/api/posts/feed",
        params={
            "scope": "notices",
            "page": 1,
            "size": 2,
            "sort": "latest",
            "pin_priority": False,
            "q": "Home ordering",
        },
        headers=api.headers["owner"],
    )
    regular = api.client.get(
        "/api/posts/feed",
        params={
            "scope": "notices",
            "page": 1,
            "size": 100,
            "sort": "latest",
            "q": "Home ordering",
        },
        headers=api.headers["owner"],
    )

    assert home.status_code == 200
    assert [item["id"] for item in home.json()["data"]] == expected_home
    assert regular.status_code == 200
    assert [item["id"] for item in regular.json()["data"]].index(pinned_id) == 0


def test_council_activity_feed_includes_linked_notices_and_legacy_activity_posts(api) -> None:
    with api.session() as db:
        notice = _board(
            name="Council Notices Feed",
            slug="council-notices-feed",
            category="notices",
            board_type="notice",
        )
        activity = _board(
            name="Council Activity Feed",
            slug="council-activity",
            category="council",
            board_type="activity_history",
        )
        db.add_all([notice, activity])
        db.flush()
        linked_notice = Post(
            board_id=notice.id,
            author_id=3,
            title="Linked council notice",
            content="Linked notice body",
            metadata_json={"show_in_council_activity": True},
        )
        unlinked_notice = Post(
            board_id=notice.id,
            author_id=3,
            title="Unlinked council notice",
            content="Unlinked notice body",
        )
        legacy_activity = Post(
            board_id=activity.id,
            author_id=3,
            title="Legacy council activity",
            content="Legacy activity body",
        )
        db.add_all([linked_notice, unlinked_notice, legacy_activity])
        db.flush()
        expected_ids = {linked_notice.id, legacy_activity.id}
        excluded_id = unlinked_notice.id
        db.commit()

    response = api.client.get(
        "/api/posts/feed",
        params={"scope": "council_activity"},
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    returned_ids = {item["id"] for item in response.json()["data"]}
    assert returned_ids == expected_ids
    assert excluded_id not in returned_ids


def test_feed_excludes_unreadable_deleted_and_blocked_author_posts(api) -> None:
    with api.session() as db:
        resource = _board(
            name="Resource Privacy Feed",
            slug="resource-privacy-feed",
            category="resources",
            board_type="resource",
        )
        db.add(resource)
        db.flush()
        visible = Post(
            board_id=resource.id,
            author_id=1,
            title="Visible resource",
            content="Visible body",
        )
        soft_deleted = Post(
            board_id=resource.id,
            author_id=1,
            title="Deleted resource",
            content="Deleted body",
            deleted_at=datetime(2026, 8, 2, 12, 0),
        )
        hidden_other = Post(
            board_id=resource.id,
            author_id=2,
            title="Hidden resource",
            content="Hidden body",
            status="hidden",
        )
        blocked_author = Post(
            board_id=resource.id,
            author_id=2,
            title="Blocked resource",
            content="Blocked body",
        )
        db.add_all([visible, soft_deleted, hidden_other, blocked_author])
        db.add(UserBlock(blocker_id=1, blocked_user_id=2, reason="feed privacy"))
        db.flush()
        visible_id = visible.id
        db.commit()

    response = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources"},
        headers=api.headers["owner"],
    )

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["data"]] == [visible_id]


def test_feed_author_search_keeps_anonymous_posts_hidden_from_users_but_available_to_admins(api) -> None:
    with api.session() as db:
        anonymous_post_board = _board(
            name="Anonymous Resource Search",
            slug="anonymous-resource-search",
            category="resources",
            board_type="resource",
        )
        forced_anonymous_board = _board(
            name="Lecture Reviews",
            slug="lecture-reviews",
            category="resources",
            board_type="resource",
        )
        db.add_all([anonymous_post_board, forced_anonymous_board])
        db.flush()
        anonymous_post = Post(
            board_id=anonymous_post_board.id,
            author_id=2,
            author_nickname_snapshot="Archived Other Alias",
            title="Anonymous author search probe",
            content="Aggregate feed anonymous identity probe",
            is_anonymous=True,
        )
        forced_anonymous_post = Post(
            board_id=forced_anonymous_board.id,
            author_id=2,
            title="Forced anonymous author search probe",
            content="Aggregate feed anonymous identity probe",
        )
        db.add_all([anonymous_post, forced_anonymous_post])
        db.flush()
        anonymous_post_id = anonymous_post.id
        expected_ids = {anonymous_post.id, forced_anonymous_post.id}
        db.commit()

    user_author_search = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "q": "Other"},
        headers=api.headers["owner"],
    )
    admin_author_search = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "q": "Other"},
        headers=api.headers["admin"],
    )
    user_snapshot_author_search = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "q": "Archived Other Alias"},
        headers=api.headers["owner"],
    )
    admin_snapshot_author_search = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "q": "Archived Other Alias"},
        headers=api.headers["admin"],
    )
    user_content_search = api.client.get(
        "/api/posts/feed",
        params={"scope": "resources", "q": "anonymous identity probe"},
        headers=api.headers["owner"],
    )

    assert user_author_search.status_code == 200
    assert user_author_search.json()["data"] == []
    assert admin_author_search.status_code == 200
    assert {item["id"] for item in admin_author_search.json()["data"]} == expected_ids
    assert {item["author_id"] for item in admin_author_search.json()["data"]} == {2}
    assert {item["author_nickname"] for item in admin_author_search.json()["data"]} == {"Other"}
    assert user_snapshot_author_search.status_code == 200
    assert user_snapshot_author_search.json()["data"] == []
    assert admin_snapshot_author_search.status_code == 200
    assert [item["id"] for item in admin_snapshot_author_search.json()["data"]] == [anonymous_post_id]
    assert user_content_search.status_code == 200
    assert {item["id"] for item in user_content_search.json()["data"]} == expected_ids
    assert {item["author_id"] for item in user_content_search.json()["data"]} == {None}
    assert {item["author_nickname"] for item in user_content_search.json()["data"]} == {"Anonymous"}


def test_feed_rejects_unknown_scope_and_invalid_notice_filter(api) -> None:
    invalid_requests = [
        {"scope": "unknown"},
        {"scope": "notices", "notice_category": "invalid"},
        {"scope": "resources", "notice_category": "academic"},
    ]

    for params in invalid_requests:
        response = api.client.get(
            "/api/posts/feed",
            params=params,
            headers=api.headers["owner"],
        )

        assert response.status_code == 422
        assert response.json() == {
            "status": "error",
            "message": "Request validation failed.",
            "code": "VALIDATION_ERROR",
        }


def test_popular_and_views_use_id_as_final_tie_breaker(api) -> None:
    with api.session() as db:
        resource = _board(
            name="Resource Tie Feed",
            slug="resource-tie-feed",
            category="resources",
            board_type="resource",
        )
        db.add(resource)
        db.flush()
        tied_at = datetime(2026, 8, 3, 12, 0)
        first = Post(
            board_id=resource.id,
            author_id=1,
            title="Lower ID",
            content="Tie body",
            view_count=50,
            like_count=20,
            comment_count=10,
            created_at=tied_at,
        )
        second = Post(
            board_id=resource.id,
            author_id=1,
            title="Higher ID",
            content="Tie body",
            view_count=50,
            like_count=20,
            comment_count=10,
            created_at=tied_at,
        )
        db.add_all([first, second])
        db.flush()
        expected = [second.id, first.id]
        board_id = resource.id
        db.commit()

    for sort in ("popular", "views"):
        feed = api.client.get(
            "/api/posts/feed",
            params={"scope": "resources", "sort": sort},
            headers=api.headers["owner"],
        )
        single_board = api.client.get(
            f"/api/boards/{board_id}/posts",
            params={"sort": sort},
            headers=api.headers["owner"],
        )

        assert feed.status_code == 200
        assert single_board.status_code == 200
        assert [item["id"] for item in feed.json()["data"]] == expected
        assert [item["id"] for item in single_board.json()["data"]] == expected


def test_board_recruiting_sort_puts_open_posts_first_across_pages(api) -> None:
    with api.session() as db:
        board = _board(name="Club Promo Sort", slug="club-promo-sort", category="participation", board_type="guide")
        db.add(board)
        db.flush()
        base = datetime(2026, 8, 1, 9, 0)
        specs = [
            ("open-old", "모집중", False),
            ("closed-new", "마감", False),
            ("legacy-empty", None, False),
            ("always", "상시", False),
            ("open-new", " 모집중 ", False),
            ("pinned-closed", "마감", True),
        ]
        posts = {
            title: Post(
                board_id=board.id,
                author_id=1,
                title=title,
                content=title,
                category=category,
                is_pinned=pinned,
                created_at=base + timedelta(minutes=index),
            )
            for index, (title, category, pinned) in enumerate(specs)
        }
        db.add_all(posts.values())
        db.commit()
        board_id = board.id

    titles = []
    for page in (1, 2, 3):
        response = api.client.get(
            f"/api/boards/{board_id}/posts",
            params={"page": page, "size": 2, "sort": "recruiting"},
            headers=api.headers["owner"],
        )
        assert response.status_code == 200
        titles += [item["title"] for item in response.json()["data"]]

    assert titles == ["pinned-closed", "open-new", "legacy-empty", "open-old", "always", "closed-new"]


def test_search_ignores_spaces_and_line_breaks_and_skips_blank_queries(api) -> None:
    with api.session() as db:
        board = _board(name="Spaceless Search", slug="spaceless-search", category="resources", board_type="resource")
        db.add(board)
        db.flush()
        db.add_all(
            [
                Post(board_id=board.id, author_id=1, title="서강 대학원 안내", content="본문"),
                Post(board_id=board.id, author_id=1, title="두 번째", content="서강\n대학원 행사"),
                Post(board_id=board.id, author_id=1, title="무관한 글", content="다른 내용"),
            ]
        )
        db.commit()
        board_id = board.id

    def titles(q: str) -> list[str]:
        response = api.client.get(f"/api/boards/{board_id}/posts", params={"q": q}, headers=api.headers["owner"])
        assert response.status_code == 200
        return sorted(item["title"] for item in response.json()["data"])

    assert titles("서강대학원") == ["두 번째", "서강 대학원 안내"]
    assert titles("서 강 대 학 원") == ["두 번째", "서강 대학원 안내"]
    assert titles("대학원행사") == ["두 번째"]
    assert titles("   ") == ["두 번째", "무관한 글", "서강 대학원 안내"]

    blank = api.client.get("/api/search", params={"q": "  "}, headers=api.headers["owner"])
    assert blank.status_code == 200
    assert blank.json()["data"] == []

    # 한 글자 검색도 받는다(2026-10-16).
    one = api.client.get("/api/search", params={"q": "두", "scope": "resources"}, headers=api.headers["owner"])
    assert one.status_code == 200
    assert [item["title"] for item in one.json()["data"]] == ["두 번째"]
