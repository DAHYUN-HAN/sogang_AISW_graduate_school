import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def load(name):
    path = Path(__file__).resolve().parents[1] / "alembic/versions" / name
    assert path.exists(), "attendance migration is missing"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def test_attendance_migration_preserves_ids_votes_and_backfills_locks_and_closures():
    before = load("0033_notice_polls.py")
    after = load("0034_independent_attendance_polls.py")
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(text("PRAGMA foreign_keys=ON"))
        for table in ("posts", "users", "media_assets"):
            connection.execute(text(f"CREATE TABLE {table} (id INTEGER PRIMARY KEY)"))
            connection.execute(text(f"INSERT INTO {table} (id) VALUES (1)"))
        with Operations.context(MigrationContext.configure(connection)):
            before.upgrade()
            connection.execute(text("INSERT INTO post_polls (id,post_id,revision,first_voted_at,closed_at,created_at,updated_at) VALUES (1,1,1,'2026-10-07 01:00:00','2026-10-07 02:00:00',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            connection.execute(text("INSERT INTO poll_questions (id,poll_id,title,kind,allow_multiple,sort_order) VALUES (10,1,'legacy','text',0,0)"))
            connection.execute(text("INSERT INTO poll_options (id,question_id,label,sort_order) VALUES (20,10,'YES',0),(21,10,'NO',1)"))
            connection.execute(text("INSERT INTO poll_ballots (id,poll_id,user_id,created_at,updated_at) VALUES (30,1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)"))
            connection.execute(text("INSERT INTO poll_selections (id,ballot_id,option_id) VALUES (40,30,20)"))
            after.upgrade()
            row = connection.execute(text("SELECT id,first_voted_at,closed_at FROM poll_questions")).one()
            assert tuple(row) == (10, '2026-10-07 01:00:00', '2026-10-07 02:00:00')
            assert tuple(connection.execute(text("SELECT id,ballot_id,option_id FROM poll_selections")).one()) == (40,30,20)
            after.downgrade()
            assert "closed_at" not in {c["name"] for c in inspect(connection).get_columns("poll_questions")}
            assert connection.scalar(text("SELECT COUNT(*) FROM poll_selections")) == 1
    engine.dispose()
