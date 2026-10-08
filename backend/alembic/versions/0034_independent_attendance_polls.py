"""Independent attendance-card closure and first-vote locks, retaining all IDs."""
from alembic import op
import sqlalchemy as sa

revision = "0034_attendance_polls"
down_revision = "0033_notice_polls"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("poll_questions", sa.Column("closed_at", sa.DateTime(), nullable=True))
    op.add_column("poll_questions", sa.Column("first_voted_at", sa.DateTime(), nullable=True))
    # Legacy votes covered every question; preserve the old freeze even if voters later left.
    op.execute("UPDATE poll_questions SET first_voted_at = (SELECT first_voted_at FROM post_polls WHERE post_polls.id = poll_questions.poll_id), closed_at = (SELECT closed_at FROM post_polls WHERE post_polls.id = poll_questions.poll_id)")


def downgrade():
    # Preserve a fully closed set when returning to the old global-close model.
    op.execute("UPDATE post_polls SET closed_at = (SELECT MAX(closed_at) FROM poll_questions WHERE poll_questions.poll_id = post_polls.id) WHERE NOT EXISTS (SELECT 1 FROM poll_questions WHERE poll_questions.poll_id = post_polls.id AND closed_at IS NULL)")
    op.drop_column("poll_questions", "first_voted_at")
    op.drop_column("poll_questions", "closed_at")
