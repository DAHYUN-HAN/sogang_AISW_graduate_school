"""Exercise the actual Alembic revision on a disposable database."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_poll_revision_round_trip_preserves_existing_parent_rows():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/0033_notice_polls.py"
    spec = importlib.util.spec_from_file_location("notice_poll_revision", path)
    revision = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(revision)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        for table in ("posts", "users", "media_assets"):
            connection.execute(text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)"))
            connection.execute(text(f"INSERT INTO {table} (id) VALUES (1)"))
        with Operations.context(MigrationContext.configure(connection)):
            revision.upgrade()
            tables = {"post_polls", "poll_questions", "poll_options", "poll_ballots", "poll_selections"}
            assert tables.issubset(inspect(connection).get_table_names())
            assert {tuple(c["column_names"]) for c in inspect(connection).get_unique_constraints("poll_ballots")} == {("poll_id", "user_id")}
            connection.execute(text("INSERT INTO post_polls (id, post_id, revision, created_at, updated_at) VALUES (1, 1, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
            revision.downgrade()
            assert not tables.intersection(inspect(connection).get_table_names())
            for table in ("posts", "users", "media_assets"):
                assert connection.scalar(text(f"SELECT COUNT(*) FROM {table}")) == 1
    engine.dispose()
