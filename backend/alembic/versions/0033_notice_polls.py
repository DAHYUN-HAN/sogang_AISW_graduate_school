"""Notice polls, questions, options and account-linked ballots.

Revision ID: 0033_notice_polls
Revises: 0032_admin_usage
"""
from alembic import op
import sqlalchemy as sa

revision = "0033_notice_polls"
down_revision = "0032_admin_usage"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table("post_polls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("post_id", sa.Integer(), sa.ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("ends_at", sa.DateTime()), sa.Column("closed_at", sa.DateTime()),
        sa.Column("first_voted_at", sa.DateTime()), sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False))
    op.create_table("poll_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("poll_id", sa.Integer(), sa.ForeignKey("post_polls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(100), nullable=False), sa.Column("kind", sa.String(10), nullable=False),
        sa.Column("allow_multiple", sa.Boolean(), nullable=False), sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("kind IN ('text', 'date')", name="ck_poll_questions_kind"))
    op.create_table("poll_options",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("question_id", sa.Integer(), sa.ForeignKey("poll_questions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("media_id", sa.Integer(), sa.ForeignKey("media_assets.id")),
        sa.Column("sort_order", sa.Integer(), nullable=False))
    op.create_table("poll_ballots",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("poll_id", sa.Integer(), sa.ForeignKey("post_polls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False), sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("poll_id", "user_id", name="uq_poll_ballots_poll_user"))
    op.create_table("poll_selections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ballot_id", sa.Integer(), sa.ForeignKey("poll_ballots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_id", sa.Integer(), sa.ForeignKey("poll_options.id", ondelete="CASCADE"), nullable=False),
        sa.UniqueConstraint("ballot_id", "option_id", name="uq_poll_selections_ballot_option"))
    for table, columns in {"poll_questions": ["poll_id"], "poll_options": ["question_id", "media_id"],
                           "poll_ballots": ["poll_id", "user_id"], "poll_selections": ["ballot_id", "option_id"]}.items():
        for column in columns:
            op.create_index(f"ix_{table}_{column}", table, [column])


def downgrade():
    for table in ["poll_selections", "poll_ballots", "poll_options", "poll_questions", "post_polls"]:
        op.drop_table(table)
