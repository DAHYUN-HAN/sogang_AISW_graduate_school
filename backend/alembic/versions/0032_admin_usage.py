"""first-party member navigation metrics

Revision ID: 0032_admin_usage
Revises: 0031_operation_status_only
"""
from alembic import op
import sqlalchemy as sa

revision = "0032_admin_usage"
down_revision = "0031_operation_status_only"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("usage_page_views",
        sa.Column("event_id", sa.String(36), primary_key=True),
        sa.Column("visitor_key", sa.String(64), nullable=False),
        sa.Column("device_id", sa.String(36), nullable=False),
        sa.Column("session_id", sa.String(36), nullable=False),
        sa.Column("screen", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_usage_page_views_created", "usage_page_views", ["created_at"])
    op.create_index("ix_usage_page_views_visitor_device_created", "usage_page_views", ["visitor_key", "device_id", "created_at"])


def downgrade():
    op.drop_index("ix_usage_page_views_visitor_device_created", table_name="usage_page_views")
    op.drop_index("ix_usage_page_views_created", table_name="usage_page_views")
    op.drop_table("usage_page_views")
