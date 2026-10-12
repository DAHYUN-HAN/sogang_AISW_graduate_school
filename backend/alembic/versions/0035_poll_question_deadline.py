"""Optional per-card deadline that closes an attendance card automatically."""
from alembic import op
import sqlalchemy as sa

revision = "0035_poll_question_deadline"
down_revision = "0034_attendance_polls"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("poll_questions", sa.Column("ends_at", sa.DateTime(), nullable=True))


def downgrade():
    # Keep cards that already passed their deadline closed at that moment.
    op.execute("UPDATE poll_questions SET closed_at = ends_at WHERE closed_at IS NULL AND ends_at IS NOT NULL AND ends_at <= (now() AT TIME ZONE 'utc')")
    op.drop_column("poll_questions", "ends_at")
