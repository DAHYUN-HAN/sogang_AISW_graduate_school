from importlib.util import module_from_spec, spec_from_file_location
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.usage import UsagePageView


def test_usage_migration_matches_model_and_preserves_idempotent_event_identity():
    path = Path(__file__).resolve().parents[1] / "alembic/versions/0032_admin_usage.py"
    spec = spec_from_file_location("admin_usage_migration", path)
    migration = module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        from datetime import datetime
        values = {"event_id": "first", "visitor_key": "v" * 64, "device_id": "device", "session_id": "session", "screen": "home", "created_at": datetime(2026, 10, 7)}
        with Session(bind=connection) as db:
            db.add(UsagePageView(**values)); db.flush()
            assert db.get(UsagePageView, "first").screen == "home"
        with pytest.raises(IntegrityError):
            with connection.begin_nested():
                connection.execute(UsagePageView.__table__.insert().values(**values))
        migration.downgrade()
        assert "usage_page_views" not in inspect(connection).get_table_names()
        migration.upgrade()
        assert "usage_page_views" in inspect(connection).get_table_names()
    engine.dispose()
