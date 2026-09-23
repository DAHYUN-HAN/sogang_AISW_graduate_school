"""add dues payment scope

Revision ID: 0028_dues_payment_scope
Revises: 0027_event_category_cleanup
Create Date: 2026-09-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0028_dues_payment_scope"
down_revision: Union[str, None] = "0027_event_category_cleanup"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("dues_payers") as batch_op:
        batch_op.add_column(
            sa.Column("is_full_paid", sa.Boolean(), nullable=False, server_default=sa.false())
        )
        batch_op.add_column(sa.Column("once_board_id", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "ck_dues_payers_payment_scope",
            "NOT (is_full_paid AND once_board_id IS NOT NULL)",
        )
        batch_op.create_foreign_key(
            "fk_dues_payers_once_board_id_boards",
            "boards",
            ["once_board_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index("ix_dues_payers_once_board_id", ["once_board_id"])

    # Every existing row represented a payer before this migration, so preserve
    # that behavior by treating the legacy roster as fully paid.
    op.execute(sa.text("UPDATE dues_payers SET is_full_paid = TRUE, once_board_id = NULL"))


def downgrade() -> None:
    with op.batch_alter_table("dues_payers") as batch_op:
        batch_op.drop_index("ix_dues_payers_once_board_id")
        batch_op.drop_constraint("fk_dues_payers_once_board_id_boards", type_="foreignkey")
        batch_op.drop_constraint("ck_dues_payers_payment_scope", type_="check")
        batch_op.drop_column("once_board_id")
        batch_op.drop_column("is_full_paid")
