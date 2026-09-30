from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        CheckConstraint(
            "category IN ('academic', 'event', 'exam', 'council', 'external', 'other')",
            name="ck_events_category",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    location: Mapped[str | None] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20))
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(DateTime)
    # 일정과 짝이 되는 공지. 홈 달력에서 이 값이 있는 일정만 눌러서 공지로 갈 수 있다.
    # 관리자가 DB에서 직접 넣는다. 일정 생성/수정 API는 이 칼럼을 받지 않으므로
    # 앱에서 일정을 고쳐도 연계가 지워지지 않는다.
    notice_post_id: Mapped[int | None] = mapped_column(ForeignKey("posts.id", ondelete="SET NULL"))
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
