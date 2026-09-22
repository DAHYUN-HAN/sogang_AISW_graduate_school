from __future__ import annotations

from dataclasses import dataclass
from typing import Mapping, Sequence
import unicodedata

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.board import Board
from app.models.post import Post


CURRENT_CLUB_NAMES = (
    "파인튜닝",
    "SG_LLM",
    "알바트로스냅",
    "서강의 봄",
    "서뽈링",
    "서강와인",
    "인간지능투자",
    "FC리턴윈",
)

GENERIC_CLUB_ACTIVITY_NAMES = frozenset({"동아리 활동 인증", "활동 인증", "안내"})


@dataclass(frozen=True)
class ClubActivityChange:
    post_id: int
    source_post_id: int
    category: str


@dataclass(frozen=True)
class ClubActivityUnmatched:
    post_id: int
    name: str | None
    reason: str


@dataclass(frozen=True)
class ClubActivityCleanupPlan:
    changes: tuple[ClubActivityChange, ...]
    unchanged_count: int
    unmatched: tuple[ClubActivityUnmatched, ...]
    source_issues: tuple[str, ...]


def normalize_club_name(value: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", value).split())


def _activity_source_post_id(metadata: dict | None) -> int | None:
    value = (metadata or {}).get("activity_source_post_id")
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if value > 0 else None
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized.isdecimal():
        return None
    parsed = int(normalized)
    return parsed if parsed > 0 else None


def _specific_activity_name(post: Post) -> str | None:
    metadata = post.metadata_json or {}
    candidates = [post.category, metadata.get("legacy_activity_name")]
    generic_names = {normalize_club_name(name) for name in GENERIC_CLUB_ACTIVITY_NAMES}
    for candidate in candidates:
        if not isinstance(candidate, str):
            continue
        normalized = normalize_club_name(candidate)
        if normalized and normalized not in generic_names:
            return normalized
    return None


def _empty_plan(*issues: str) -> ClubActivityCleanupPlan:
    return ClubActivityCleanupPlan(changes=(), unchanged_count=0, unmatched=(), source_issues=tuple(issues))


def build_club_activity_cleanup_plan(
    db: Session,
    *,
    aliases: Mapping[str, str],
    expected_current_names: Sequence[str] = CURRENT_CLUB_NAMES,
) -> ClubActivityCleanupPlan:
    promo_board = db.scalar(select(Board).where(Board.slug == "club-promo"))
    activity_board = db.scalar(select(Board).where(Board.slug == "club-activity"))
    missing_boards = [
        slug
        for slug, board in (("club-promo", promo_board), ("club-activity", activity_board))
        if board is None
    ]
    if missing_boards:
        return _empty_plan(*(f"missing board: {slug}" for slug in missing_boards))
    assert promo_board is not None
    assert activity_board is not None

    current_sources = db.scalars(
        select(Post)
        .where(
            Post.board_id == promo_board.id,
            Post.status == "published",
            Post.deleted_at.is_(None),
        )
        .order_by(Post.id.asc())
    ).all()
    current_by_name: dict[str, list[Post]] = {}
    for source in current_sources:
        current_by_name.setdefault(normalize_club_name(source.title), []).append(source)

    source_issues: list[str] = []
    if not promo_board.is_active:
        source_issues.append("club-promo board is inactive")
    expected_by_name = {normalize_club_name(name): name for name in expected_current_names}
    for normalized, official_name in expected_by_name.items():
        matches = current_by_name.get(normalized, [])
        if not matches:
            source_issues.append(f"missing current club: {official_name}")
        elif len(matches) > 1:
            source_issues.append(f"duplicate current club: {official_name}")
        elif matches[0].title != official_name:
            source_issues.append(
                f"non-canonical current club title: {matches[0].title} -> {official_name}"
            )
    for normalized, matches in current_by_name.items():
        if normalized not in expected_by_name:
            source_issues.extend(f"unexpected current club: {source.title}" for source in matches)

    alias_sources: dict[str, Post] = {}
    for alias, official_name in aliases.items():
        normalized_alias = normalize_club_name(alias)
        normalized_official = normalize_club_name(official_name)
        matches = current_by_name.get(normalized_official, [])
        if not normalized_alias:
            source_issues.append("empty club alias")
        elif len(matches) != 1:
            source_issues.append(f"invalid alias target: {alias} -> {official_name}")
        else:
            alias_sources[normalized_alias] = matches[0]

    all_sources = db.scalars(
        select(Post).where(Post.board_id == promo_board.id).order_by(Post.id.asc())
    ).all()
    all_sources_by_id = {source.id: source for source in all_sources}
    activities = db.scalars(
        select(Post)
        .where(Post.board_id == activity_board.id, Post.deleted_at.is_(None))
        .order_by(Post.id.asc())
    ).all()

    changes: list[ClubActivityChange] = []
    unmatched: list[ClubActivityUnmatched] = []
    unchanged_count = 0
    for activity in activities:
        existing_source_id = _activity_source_post_id(activity.metadata_json)
        existing_source = all_sources_by_id.get(existing_source_id) if existing_source_id is not None else None
        if existing_source is not None:
            canonical_id = str(existing_source.id)
            stored_id = (activity.metadata_json or {}).get("activity_source_post_id")
            if activity.category == existing_source.title and stored_id == canonical_id:
                unchanged_count += 1
            else:
                changes.append(
                    ClubActivityChange(
                        post_id=activity.id,
                        source_post_id=existing_source.id,
                        category=existing_source.title,
                    )
                )
            continue

        activity_name = _specific_activity_name(activity)
        if activity_name is None:
            unmatched.append(
                ClubActivityUnmatched(post_id=activity.id, name=None, reason="missing specific club name")
            )
            continue
        candidates = current_by_name.get(activity_name, [])
        source = alias_sources.get(activity_name)
        if source is None and len(candidates) == 1:
            source = candidates[0]
        if source is None:
            reason = "ambiguous current club" if len(candidates) > 1 else "no matching current club"
            unmatched.append(ClubActivityUnmatched(post_id=activity.id, name=activity_name, reason=reason))
            continue
        changes.append(
            ClubActivityChange(post_id=activity.id, source_post_id=source.id, category=source.title)
        )

    return ClubActivityCleanupPlan(
        changes=tuple(changes),
        unchanged_count=unchanged_count,
        unmatched=tuple(unmatched),
        source_issues=tuple(source_issues),
    )


def apply_club_activity_cleanup_plan(db: Session, plan: ClubActivityCleanupPlan) -> int:
    if plan.source_issues:
        raise ValueError("current club source audit failed")
    for change in plan.changes:
        post = db.get(Post, change.post_id)
        if post is None or post.deleted_at is not None:
            raise ValueError(f"activity post is no longer available: {change.post_id}")
        metadata = dict(post.metadata_json or {})
        metadata["activity_source_post_id"] = str(change.source_post_id)
        post.metadata_json = metadata
        post.category = change.category
    return len(plan.changes)
