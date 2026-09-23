from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DuesPayer(Base):
    __tablename__ = "dues_payers"
    __table_args__ = (
        UniqueConstraint("student_number", name="uq_dues_payers_student_number"),
        CheckConstraint(
            "NOT (is_full_paid AND once_board_id IS NOT NULL)",
            name="ck_dues_payers_payment_scope",
        ),
        Index("ix_dues_payers_name", "name"),
        Index("ix_dues_payers_once_board_id", "once_board_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    student_number: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    major: Mapped[str] = mapped_column(String(100), nullable=False)
    is_full_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    once_board_id: Mapped[int | None] = mapped_column(
        ForeignKey("boards.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
