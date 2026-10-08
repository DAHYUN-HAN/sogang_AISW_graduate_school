"""Exercise real hierarchy handlers on disposable PostgreSQL transactions."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from time import monotonic

import pytest
from sqlalchemy import event, select, text

from app.board_navigation import parent_id
from app.errors import AppException
from app.models.board import Board
from app.models.user import User
from app.routers.boards import create_admin_board, remove_admin_board, update_admin_board
from app.schemas.board import BoardAdminCreate, BoardAdminUpdate


def _create(api, slug, parent=None):
    with api.session() as db:
        return create_admin_board(BoardAdminCreate(
            name=slug, slug=slug, category="resources", board_type="resource",
            metadata={"admin_navigation": {"section": "resources", "parent_board_id": parent}},
        ), db, db.get(User, 3))["data"]["id"]


def _interleave(api, first_action, second_action):
    with api.session() as db:
        if db.get_bind().dialect.name != "postgresql":
            pytest.skip("PostgreSQL is required to verify transaction locks")
    first_ready, release_first, second_ready, second_commit = Event(), Event(), Event(), Event()
    second_pid = []

    def first():
        with api.session() as db:
            def pause(_session):
                first_ready.set()
                if not release_first.wait(15):
                    raise TimeoutError("Second hierarchy transaction did not reach its serialization point")
            event.listen(db, "before_commit", pause, once=True)
            return first_action(db, db.get(User, 3))

    def second():
        with api.session() as db:
            second_pid.append(db.scalar(text("SELECT pg_backend_pid()")))
            event.listen(db, "before_commit", lambda _session: second_commit.set(), once=True)
            second_ready.set()
            try:
                return second_action(db, db.get(User, 3))
            except AppException as error:
                db.rollback()
                return {"status": "error", "code": error.code, "http_status": error.status_code}

    with ThreadPoolExecutor(max_workers=2) as pool:
        a = pool.submit(first)
        try:
            assert first_ready.wait(10), "First mutation did not finish validation"
            b = pool.submit(second)
            assert second_ready.wait(10), "Second mutation did not start"
            deadline = monotonic() + 10
            reached = False
            while monotonic() < deadline:
                if second_commit.is_set() or b.done():
                    reached = True
                    break
                with api.session() as observer:
                    waiting = observer.scalar(text(
                        "SELECT wait_event = 'advisory' AND wait_event_type = 'Lock' "
                        "FROM pg_stat_activity WHERE pid = :pid"
                    ), {"pid": second_pid[0]})
                if waiting:
                    reached = True
                    break
                second_commit.wait(0.03)
            assert reached, "Second transaction neither serialized nor completed validation"
        finally:
            release_first.set()
        return a.result(timeout=15), b.result(timeout=15)


def test_concurrent_reparent_cannot_commit_a_cycle(api):
    first_id, second_id = _create(api, "race-first"), _create(api, "race-second")

    def move(board_id, target_id, db, admin):
        return update_admin_board(board_id, BoardAdminUpdate(metadata={
            "admin_navigation": {"section": "resources", "parent_board_id": target_id},
        }), db, admin)

    first, second = _interleave(
        api, lambda db, admin: move(first_id, second_id, db, admin),
        lambda db, admin: move(second_id, first_id, db, admin),
    )
    assert first["status"] == "success"
    assert second == {"status": "error", "code": "INVALID_BOARD_PARENT", "http_status": 422}
    with api.session() as db:
        assert parent_id(db.get(Board, first_id)) == second_id
        assert parent_id(db.get(Board, second_id)) is None


def test_child_created_during_archive_cannot_remain_active(api):
    root_id = _create(api, "archive-race-root")
    first, second = _interleave(
        api, lambda db, admin: remove_admin_board(root_id, db, admin),
        lambda db, admin: create_admin_board(BoardAdminCreate(
            name="Archive child", slug="archive-race-child", category="resources", board_type="resource",
            metadata={"admin_navigation": {"section": "resources", "parent_board_id": root_id}},
        ), db, admin),
    )
    assert first["status"] == "success"
    assert second == {"status": "error", "code": "INVALID_BOARD_PARENT", "http_status": 422}
    with api.session() as db:
        assert db.get(Board, root_id).is_active is False
        assert db.scalar(select(Board).where(Board.slug == "archive-race-child")) is None
