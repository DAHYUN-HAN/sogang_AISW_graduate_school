from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


PaymentScope = Literal["ALL", "ONCE", "UNPAID"]


class DuesPayerWriteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=50)
    major: str = Field(min_length=1, max_length=100)
    student_number: str = Field(pattern=r"^[Aa]\d{5}$")
    payment_scope: PaymentScope
    once_board_id: int | None = Field(default=None, ge=1)

    @field_validator("name", "major", mode="before")
    @classmethod
    def strip_text(cls, value):
        return value.strip() if isinstance(value, str) else value

    @field_validator("student_number", mode="before")
    @classmethod
    def normalize_student_number(cls, value):
        return value.upper() if isinstance(value, str) else value

    @model_validator(mode="after")
    def validate_scope(self):
        if self.payment_scope == "ONCE" and self.once_board_id is None:
            raise ValueError("ONCE requires once_board_id")
        if self.payment_scope != "ONCE" and self.once_board_id is not None:
            raise ValueError("once_board_id is allowed only for ONCE")
        return self


class DuesPayerDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmation: str = Field(min_length=1, max_length=20)
