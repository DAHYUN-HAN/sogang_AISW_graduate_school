"""link an event to the notice post that explains it

Revision ID: 0030_event_notice_link
Revises: 0029_roster_dues_separation
Create Date: 2026-09-29
"""

from alembic import op
import sqlalchemy as sa

revision = "0030_event_notice_link"
down_revision = "0029_roster_dues_separation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 기존 일정은 모두 빈 값으로 둔다. 관리자가 필요한 일정에만 DB에서 직접 넣는다.
    op.add_column("events", sa.Column("notice_post_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_events_notice_post_id",
        "events",
        "posts",
        ["notice_post_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_events_notice_post_id", "events", ["notice_post_id"])


def downgrade() -> None:
    op.drop_index("ix_events_notice_post_id", table_name="events")
    op.drop_constraint("fk_events_notice_post_id", "events", type_="foreignkey")
    op.drop_column("events", "notice_post_id")
