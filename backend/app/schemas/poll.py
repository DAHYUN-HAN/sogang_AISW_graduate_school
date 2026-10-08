from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

PositiveId = Annotated[int, Field(ge=1, strict=True)]


class PollOptionDraft(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    id: PositiveId | None = None
    label: str = Field(min_length=1, max_length=100)
    media_id: PositiveId | None = None


class PollQuestionDraft(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    id: PositiveId | None = None
    title: str = Field(min_length=1, max_length=100)
    kind: Literal["text", "date"] = "text"
    allow_multiple: bool = False
    options: list[PollOptionDraft] = Field(min_length=2, max_length=20)

    @model_validator(mode="after")
    def validate_options(self):
        if self.id is None and (self.kind != "text" or self.allow_multiple or len(self.options) != 2 or any(o.media_id for o in self.options)):
            raise ValueError("참석 투표는 이름을 바꿀 수 있는 두 항목 중 하나만 선택합니다.")
        labels = [o.label for o in self.options]
        if len(labels) != len(set(labels)):
            raise ValueError("선택항목은 중복할 수 없습니다.")
        if self.kind == "date":
            for label in labels:
                if date.fromisoformat(label).isoformat() != label:
                    raise ValueError("날짜 항목은 YYYY-MM-DD 형식이어야 합니다.")
        return self


class PollDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: PositiveId | None = None
    ends_at: datetime | None = None
    questions: list[PollQuestionDraft] = Field(min_length=1, max_length=20)

    @field_validator("ends_at")
    @classmethod
    def utc_deadline(cls, value):
        if value is not None:
            raise ValueError("투표는 관리자가 직접 종료합니다. 마감 날짜를 설정할 수 없습니다.")
        return value


class PollAnswer(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question_id: PositiveId
    option_ids: list[PositiveId] = Field(min_length=1, max_length=20)


class PollVote(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: PositiveId
    answers: list[PollAnswer] = Field(min_length=1, max_length=20)
