from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DuesPayment(Base):
    __tablename__ = "dues_payments"
    __table_args__ = (
        UniqueConstraint("roster_member_id", name="uq_dues_payments_roster_member_id"),
        CheckConstraint(
            "(scope = 'ALL' AND once_board_id IS NULL) OR "
            "(scope = 'ONCE' AND once_board_id IS NOT NULL)",
            name="ck_dues_payments_scope",
        ),
        Index("ix_dues_payments_once_board_id", "once_board_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    roster_member_id: Mapped[int] = mapped_column(
        ForeignKey("student_roster.id", ondelete="CASCADE"),
        nullable=False,
    )
    scope: Mapped[str] = mapped_column(String(10), nullable=False)
    once_board_id: Mapped[int | None] = mapped_column(
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
