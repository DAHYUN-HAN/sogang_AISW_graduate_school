from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

POST_TITLE_MAX_LENGTH = 100
POST_CONTENT_MAX_LENGTH = 10_000


class PostMutationBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=POST_TITLE_MAX_LENGTH)
    # Mutual-aid requests reuse content for optional remarks, so the router
    # applies the board-aware required check after resolving the target board.
    # Album requests still carry a validated body (the client uses the title);
    # the router discards it when persisting image-only album posts.
    content: str = Field(max_length=POST_CONTENT_MAX_LENGTH)
    is_anonymous: bool = False
    category: str | None = None
    metadata: dict | None = None


class PostCreate(PostMutationBase):
    attachment_ids: list[int] = Field(default_factory=list)
    deadline_at: datetime | None = None


class PostUpdate(PostMutationBase):
    board_id: int | None = Field(default=None, ge=1)
    attachment_ids: list[int] | None = None
    replace_evidence: bool = False
    deadline_at: datetime | None = None


class PostRepresentativeImageUpdate(BaseModel):
    media_id: int = Field(ge=1)


class SuggestionUpdate(BaseModel):
    status: str = Field(pattern="^(received|answered)$")
    admin_reply: str | None = None


class MutualAidUpdate(BaseModel):
    status: str = Field(pattern="^(processing|completed|rejected)$")
    rejection_reason: str | None = None


class PostListItem(BaseModel):
    id: int
    board_id: int
    title: str
    content_preview: str
    author_id: int | None
    author_nickname: str
    is_pinned: bool
    is_notice: bool
    view_count: int
    like_count: int
    comment_count: int
    created_at: datetime


class PostDetail(BaseModel):
    id: int
    board_id: int
    title: str
    content: str
    author_id: int | None
    author_nickname: str
    is_pinned: bool
    is_notice: bool
    view_count: int
    like_count: int
    comment_count: int
    is_liked: bool
    is_bookmarked: bool
    created_at: datetime
    updated_at: datetime
