from pathlib import Path
from importlib.util import module_from_spec, spec_from_file_location

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations


MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0026_dues_payers.py"
)
PAYMENT_SCOPE_MIGRATION_PATH = (
    Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0028_dues_payment_scope.py"
)


def _load_migration():
    spec = spec_from_file_location("dues_payer_migration", MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _load_payment_scope_migration():
    spec = spec_from_file_location("dues_payment_scope_migration", PAYMENT_SCOPE_MIGRATION_PATH)
    assert spec is not None and spec.loader is not None
    module = module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dues_payer_migration_creates_unique_searchable_roster_table() -> None:
    migration = _load_migration()
    assert migration.down_revision == "0025_author_content_snapshots"
    engine = sa.create_engine("sqlite:///:memory:")

    with engine.begin() as connection:
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        inspector = sa.inspect(connection)

        assert "dues_payers" in inspector.get_table_names()
        assert {column["name"] for column in inspector.get_columns("dues_payers")} == {
            "id",
            "student_number",
            "name",
            "major",
            "created_at",
            "updated_at",
        }
        assert any(
            constraint["name"] == "uq_dues_payers_student_number"
            and constraint["column_names"] == ["student_number"]
            for constraint in inspector.get_unique_constraints("dues_payers")
        )
        assert any(
            index["name"] == "ix_dues_payers_name"
            and index["column_names"] == ["name"]
            for index in inspector.get_indexes("dues_payers")
        )

        migration.downgrade()
        assert "dues_payers" not in sa.inspect(connection).get_table_names()


def test_dues_payer_model_matches_migration_constraints() -> None:
    from app.models.dues_payer import DuesPayer

    constraints = {constraint.name for constraint in DuesPayer.__table__.constraints}
    indexes = {index.name: tuple(column.name for column in index.columns) for index in DuesPayer.__table__.indexes}

    assert "uq_dues_payers_student_number" in constraints
    assert "ck_dues_payers_payment_scope" in constraints
    assert indexes["ix_dues_payers_name"] == ("name",)
    assert indexes["ix_dues_payers_once_board_id"] == ("once_board_id",)
    assert DuesPayer.__table__.c.is_full_paid.nullable is False
    assert DuesPayer.__table__.c.once_board_id.nullable is True


def test_dues_payment_scope_migration_backfills_existing_rows_and_enforces_scope() -> None:
    roster_migration = _load_migration()
    migration = _load_payment_scope_migration()
    assert migration.down_revision == "0027_event_category_cleanup"
    engine = sa.create_engine("sqlite:///:memory:")

    with engine.begin() as connection:
        connection.execute(sa.text("PRAGMA foreign_keys=ON"))
        connection.execute(sa.text("CREATE TABLE boards (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL)"))
        roster_migration.op = Operations(MigrationContext.configure(connection))
        roster_migration.upgrade()
        connection.execute(
            sa.text(
                "INSERT INTO dues_payers "
                "(student_number, name, major, created_at, updated_at) "
                "VALUES ('A74001', '기존납부자', '인공지능', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )

        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        inspector = sa.inspect(connection)
        columns = {column["name"]: column for column in inspector.get_columns("dues_payers")}

        assert columns["is_full_paid"]["nullable"] is False
        assert columns["once_board_id"]["nullable"] is True
        assert connection.execute(
            sa.text("SELECT is_full_paid, once_board_id FROM dues_payers WHERE student_number = 'A74001'")
        ).one() == (True, None)
        assert any(
            item["name"] == "ck_dues_payers_payment_scope"
            for item in inspector.get_check_constraints("dues_payers")
        )
        assert any(
            item["name"] == "fk_dues_payers_once_board_id_boards"
            and item["options"].get("ondelete") == "SET NULL"
            for item in inspector.get_foreign_keys("dues_payers")
        )
        assert any(
            item["name"] == "ix_dues_payers_once_board_id"
            and item["column_names"] == ["once_board_id"]
            for item in inspector.get_indexes("dues_payers")
        )

        with pytest.raises(sa.exc.IntegrityError):
            connection.execute(
                sa.text(
                    "UPDATE dues_payers SET is_full_paid = TRUE, once_board_id = 1 "
                    "WHERE student_number = 'A74001'"
                )
            )


def test_deleting_once_board_clears_board_specific_payment_scope() -> None:
    roster_migration = _load_migration()
    migration = _load_payment_scope_migration()
    engine = sa.create_engine("sqlite:///:memory:")

    with engine.begin() as connection:
        connection.execute(sa.text("PRAGMA foreign_keys=ON"))
        connection.execute(sa.text("CREATE TABLE boards (id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL)"))
        roster_migration.op = Operations(MigrationContext.configure(connection))
        roster_migration.upgrade()
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        connection.execute(sa.text("INSERT INTO boards (id, name) VALUES (12, '스터디 활동 인증')"))
        connection.execute(
            sa.text(
                "INSERT INTO dues_payers "
                "(student_number, name, major, is_full_paid, once_board_id, created_at, updated_at) "
                "VALUES ('A74002', '게시판납부자', '인공지능', FALSE, 12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
            )
        )

        connection.execute(sa.text("DELETE FROM boards WHERE id = 12"))

        assert connection.execute(
            sa.text("SELECT is_full_paid, once_board_id FROM dues_payers WHERE student_number = 'A74002'")
        ).one() == (False, None)
