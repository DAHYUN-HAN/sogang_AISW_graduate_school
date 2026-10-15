from sqlalchemy import func

# 검색은 띄어쓰기·줄바꿈·탭·특수 공백을 모두 무시한다. 옛 글에는 nbsp와 전각 공백이 섞여 있다.
_IGNORED_SPACES = (" ", "\n", "\r", "\t", " ", "　")


def search_pattern(q: str | None) -> str | None:
    """검색어에서 공백을 모두 뺀 ILIKE 패턴. 공백뿐이면 검색하지 않으므로 None."""
    compact = "".join((q or "").split())
    return f"%{compact}%" if compact else None


def contains(column, pattern: str):
    """칸의 공백을 모두 뺀 값이 패턴을 포함하는지 본다."""
    for space in _IGNORED_SPACES:
        column = func.replace(column, space, "")
    return column.ilike(pattern)
