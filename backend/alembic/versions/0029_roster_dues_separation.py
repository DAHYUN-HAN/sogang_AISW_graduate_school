"""separate permanent roster from current dues payments

Revision ID: 0029_roster_dues_separation
Revises: 0028_dues_payment_scope
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0029_roster_dues_separation"
down_revision: Union[str, None] = "0028_dues_payment_scope"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _sync_postgresql_sequence(table_name: str) -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(
        sa.text(
            f"SELECT setval(pg_get_serial_sequence('{table_name}', 'id'), "
            f"COALESCE((SELECT MAX(id) FROM {table_name}), 1), "
            f"EXISTS (SELECT 1 FROM {table_name}))"
        )
    )


def upgrade() -> None:
    op.create_table(
        "student_roster",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_number", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("major", sa.String(length=100), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_number", name="uq_student_roster_student_number"),
    )
    op.create_index("ix_student_roster_name", "student_roster", ["name"])
    op.create_index("ix_student_roster_major", "student_roster", ["major"])

    op.create_table(
        "dues_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("roster_member_id", sa.Integer(), nullable=False),
        sa.Column("scope", sa.String(length=10), nullable=False),
        sa.Column("once_board_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "(scope = 'ALL' AND once_board_id IS NULL) OR "
            "(scope = 'ONCE' AND once_board_id IS NOT NULL)",
            name="ck_dues_payments_scope",
        ),
        sa.ForeignKeyConstraint(
            ["roster_member_id"],
            ["student_roster.id"],
            name="fk_dues_payments_roster_member_id_student_roster",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["once_board_id"],
            ["boards.id"],
            name="fk_dues_payments_once_board_id_boards",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("roster_member_id", name="uq_dues_payments_roster_member_id"),
    )
    op.create_index("ix_dues_payments_once_board_id", "dues_payments", ["once_board_id"])

    op.execute(
        sa.text(
            "INSERT INTO student_roster "
            "(id, student_number, name, major, created_at, updated_at) "
            "SELECT id, student_number, name, major, created_at, updated_at FROM dues_payers"
        )
    )
    op.execute(
        sa.text(
            "INSERT INTO dues_payments "
            "(id, roster_member_id, scope, once_board_id, created_at, updated_at) "
            "SELECT id, id, "
            "CASE WHEN is_full_paid THEN 'ALL' ELSE 'ONCE' END, "
            "once_board_id, created_at, updated_at "
            "FROM dues_payers WHERE is_full_paid = TRUE OR once_board_id IS NOT NULL"
        )
    )
    _sync_postgresql_sequence("student_roster")
    _sync_postgresql_sequence("dues_payments")
    op.drop_table("dues_payers")


def downgrade() -> None:
    op.create_table(
        "dues_payers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("student_number", sa.String(length=20), nullable=False),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("major", sa.String(length=100), nullable=False),
        sa.Column("is_full_paid", sa.Boolean(), nullable=False),
        sa.Column("once_board_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint(
            "NOT (is_full_paid AND once_board_id IS NOT NULL)",
            name="ck_dues_payers_payment_scope",
        ),
        sa.ForeignKeyConstraint(
            ["once_board_id"],
            ["boards.id"],
            name="fk_dues_payers_once_board_id_boards",
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_number", name="uq_dues_payers_student_number"),
    )
    op.create_index("ix_dues_payers_name", "dues_payers", ["name"])
    op.create_index("ix_dues_payers_once_board_id", "dues_payers", ["once_board_id"])

    op.execute(
        sa.text(
            "INSERT INTO dues_payers "
            "(id, student_number, name, major, is_full_paid, once_board_id, created_at, updated_at) "
            "SELECT roster.id, roster.student_number, roster.name, roster.major, "
            "CASE WHEN payment.scope = 'ALL' THEN TRUE ELSE FALSE END, "
            "CASE WHEN payment.scope = 'ONCE' THEN payment.once_board_id ELSE NULL END, "
            "roster.created_at, roster.updated_at "
            "FROM student_roster AS roster "
            "LEFT JOIN dues_payments AS payment ON payment.roster_member_id = roster.id"
        )
    )
    _sync_postgresql_sequence("dues_payers")
    op.drop_table("dues_payments")
    op.drop_table("student_roster")
