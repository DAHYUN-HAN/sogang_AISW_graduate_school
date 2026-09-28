from __future__ import annotations

import re


ADMIN_PARTICIPATION_BOARD_SLUGS = frozenset({"club-promo", "networking-programs"})

# 활동인증 게시판 -> 활동 대상을 고르는 안내 게시판.
# 인증 글의 activity_source_post_id는 반드시 짝이 되는 게시판의 글이어야 한다.
ACTIVITY_SOURCE_BOARD_SLUGS = {
    "club-activity": "club-promo",
    "study-activity": "study-recruit",
    "networking-activity": "networking-programs",
}

# 운영 상태를 들고 있는 게시판은 곧 활동 대상이 되는 게시판이다. 따로 적으면
# 새 활동 유형이 생길 때 한쪽만 고치게 된다.
OPERATION_STATUS_BOARD_SLUGS = frozenset(ACTIVITY_SOURCE_BOARD_SLUGS.values())

# 운영이 끝난 대상은 새 활동인증의 선택 목록에서 빠진다. 값이 없으면 운영 중으로 본다.
OPERATION_STATUS_KEY = "operation_status"
LEGACY_OPERATION_STATUS_KEY = "club_operation_status"
OPERATION_STATUS_VALUES = ("active", "ended")


def operation_status(metadata: dict | None) -> str:
    """운영 상태를 읽는다. 정확히 "ended"일 때만 종료로 본다."""

    stored = (metadata or {}).get(OPERATION_STATUS_KEY)
    if stored is None:
        stored = (metadata or {}).get(LEGACY_OPERATION_STATUS_KEY)
    return "ended" if stored == "ended" else "active"


_PARTICIPATION_LINK_LINE = re.compile(
    r"^\s*(?:참여|가입|신청)\s*링크\s*(?::|：|-)?\s*(https?://\S+)\s*$",
    re.IGNORECASE,
)


def normalize_participation_guide(
    board_slug: str,
    content: str,
    metadata: dict | None,
) -> tuple[str, dict | None]:
    """Keep participation URLs in CTA metadata, never as a duplicate body line."""

    if board_slug not in ADMIN_PARTICIPATION_BOARD_SLUGS:
        return content, metadata

    normalized_metadata = dict(metadata or {})
    application_url = str(normalized_metadata.get("application_url") or "").strip()
    retained_lines: list[str] = []
    extracted_url: str | None = None

    lines = content.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    index = 0
    while index < len(lines):
        line = lines[index]
        match = _PARTICIPATION_LINK_LINE.fullmatch(line)
        if match:
            extracted_url = extracted_url or match.group(1)
            following_index = index + 1
            while following_index < len(lines) and not lines[following_index].strip():
                following_index += 1
            preceding_blanks = 0
            for retained_line in reversed(retained_lines):
                if retained_line.strip():
                    break
                preceding_blanks += 1
            following_blanks = following_index - index - 1
            retained_lines.extend([""] * max(0, following_blanks - preceding_blanks))
            index = following_index
            continue
        retained_lines.append(line)
        index += 1

    if extracted_url is None:
        return content, metadata

    if not application_url and extracted_url:
        normalized_metadata["application_url"] = extracted_url

    visible_content = "\n".join(retained_lines).strip("\n")
    return visible_content, normalized_metadata or None
