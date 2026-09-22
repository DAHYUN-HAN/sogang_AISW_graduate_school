from app.models.board import Board


ANONYMOUS_BOARD_SLUGS = frozenset({"lecture-reviews"})
RESOURCE_CATEGORY_LABELS = {
    "lecture-reviews": "강의후기",
    "exam-archive": "시험족보",
    "comprehensive-exam": "종합시험",
    "graduation-thesis": "졸업논문",
}


def canonical_post_category(board: Board, submitted_category: str | None) -> str | None:
    if board.board_type == "album":
        return None
    if board.category == "resources" and board.board_type == "resource":
        return RESOURCE_CATEGORY_LABELS.get(board.slug, board.name)
    return submitted_category


def hides_author_identity(board: Board) -> bool:
    return board.slug in ANONYMOUS_BOARD_SLUGS
