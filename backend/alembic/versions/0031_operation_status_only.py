"""move legacy club operation state to operation_status

Revision ID: 0031_operation_status_only
Revises: 0030_event_notice_link
Create Date: 2026-09-30
"""

from alembic import op
import sqlalchemy as sa


revision = "0031_operation_status_only"
down_revision = "0030_event_notice_link"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The new key wins if both keys exist. Match the API's previous rule:
    # only the exact value "ended" means that operations have ended.
    op.execute(
        sa.text(
            """
            UPDATE posts
            SET metadata = jsonb_set(
                metadata - 'club_operation_status',
                '{operation_status}',
                to_jsonb(
                    CASE
                        WHEN coalesce(metadata ->> 'operation_status', metadata ->> 'club_operation_status') = 'ended'
                        THEN 'ended'::text
                        ELSE 'active'::text
                    END
                ),
                true
            )
            WHERE metadata ? 'club_operation_status'
            """
        )
    )


def downgrade() -> None:
    # The original key and whether it was present cannot be recovered.
    pass
