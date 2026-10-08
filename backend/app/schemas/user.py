from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import Literal


class UserMeResponse(BaseModel):
    id: int
    nickname: str
    cohort: str | None = None
    major: str | None = None
    phone: str | None = None
    company: str | None = None
    job_title: str | None = None
    position: str | None = None
    email: EmailStr
    role: str


class UserMeUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    major: str | None = None
    phone: str | None = None
    company: str | None = None
    job_title: str | None = None
    position: str | None = None
    profile_image_url: str | None = None


class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str


class UserPasswordVerify(BaseModel):
    current_password: str


class AdminUserPasswordReset(BaseModel):
    model_config = ConfigDict(extra="forbid")

    new_password: str = Field(min_length=8, max_length=1024)


class UserDeleteRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(min_length=1, max_length=1024)


class UserBlockCreate(BaseModel):
    blocked_user_id: int
    reason: str | None = Field(default=None, max_length=500)


class UserBlockItem(BaseModel):
    id: int
    blocked_user_id: int
    blocked_user_nickname: str
    reason: str | None = None
    created_at: str


class AdminUserUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "admin"] | None = None
    is_active: bool | None = None
    enrollment_status: Literal["active", "leave", "graduated"] | None = None
    nickname: str | None = Field(default=None, min_length=1, max_length=50)
    cohort: str | None = Field(default=None, max_length=20)
    major: str | None = Field(default=None, max_length=100)
    phone: str | None = Field(default=None, max_length=20)
    company: str | None = Field(default=None, max_length=100)
    job_title: str | None = Field(default=None, max_length=100)
    position: str | None = Field(default=None, max_length=100)

    @field_validator("nickname", mode="before")
    @classmethod
    def normalize_name(cls, value):
        if isinstance(value, str):
            return " ".join(value.strip().split())
        return value

    @field_validator("role", "is_active", "enrollment_status", "nickname")
    @classmethod
    def reject_explicit_null(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value

    @field_validator("cohort", "major", "phone", "company", "job_title", "position", mode="before")
    @classmethod
    def normalize_optional_text(cls, value):
        return value.strip() or None if isinstance(value, str) else value
