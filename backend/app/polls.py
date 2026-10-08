"""Notice poll persistence and validation; callers own the transaction."""
from collections import defaultdict

from sqlalchemy import case, delete, func, select
from sqlalchemy.orm import Session

from app.audit import log_admin_action
from app.deps import require_admin
from app.errors import AppException
from app.models.media import MediaAsset
from app.models.board import Board
from app.models.poll import PollBallot, PollOption, PollQuestion, PollSelection, PostPoll
from app.models.post import Post
from app.models.user import User
from app.post_access import require_post_read
from app.schemas.poll import PollDraft, PollVote
from app.security import utc_now


def fail(code, message, status=422):
    raise AppException(status_code=status, code=code, message=message)


def closed(question):
    return question.closed_at is not None


def get_poll(db, post_id):
    return db.scalar(select(PostPoll).where(PostPoll.post_id == post_id))


def admin_poll_summaries(db: Session, post_ids: list[int]) -> dict[int, dict]:
    """Aggregate only the selected admin page; never load ballots per notice."""
    if not post_ids:
        return {}
    ballots = (select(PollBallot.poll_id, func.count(PollBallot.id).label("participants"))
               .join(PostPoll, PostPoll.id == PollBallot.poll_id)
               .where(PostPoll.post_id.in_(post_ids)).group_by(PollBallot.poll_id).subquery())
    rows = db.execute(select(PostPoll.post_id, func.count(PollQuestion.id),
                             func.count(case((PollQuestion.closed_at.is_(None), PollQuestion.id))),
                             func.coalesce(ballots.c.participants, 0))
                      .outerjoin(PollQuestion, PollQuestion.poll_id == PostPoll.id)
                      .outerjoin(ballots, ballots.c.poll_id == PostPoll.id)
                      .where(PostPoll.post_id.in_(post_ids))
                      .group_by(PostPoll.post_id, ballots.c.participants)).all()
    return {post_id: {"question_count": total, "open_count": opened, "closed_count": total - opened,
                      "participant_count": participants} for post_id, total, opened, participants in rows}


def readable_poll(db, post_id, user, *, lock=False):
    query = select(Post).where(Post.id == post_id, Post.deleted_at.is_(None))
    post = db.scalar(query.with_for_update() if lock else query)
    if post is None:
        fail("NOT_FOUND", "공지를 찾을 수 없습니다.", 404)
    if lock:
        db.scalar(select(Board).where(Board.id == post.board_id).with_for_update(read=True)
                  .execution_options(populate_existing=True))
    board = require_post_read(db, post, user)
    poll = get_poll(db, post_id)
    if poll is None or board.board_type != "notice":
        fail("NOT_FOUND", "투표를 찾을 수 없습니다.", 404)
    return post, board, poll


def questions_and_options(db, poll):
    questions = list(db.scalars(select(PollQuestion).where(PollQuestion.poll_id == poll.id)
                               .order_by(PollQuestion.sort_order, PollQuestion.id)))
    options = list(db.scalars(select(PollOption).join(PollQuestion)
                             .where(PollQuestion.poll_id == poll.id)
                             .order_by(PollQuestion.sort_order, PollOption.sort_order, PollOption.id)))
    return questions, options


def serialize_poll(db, poll, user):
    if poll is None:
        return None
    questions, options = questions_and_options(db, poll)
    counts = dict(db.execute(select(PollSelection.option_id, func.count(PollSelection.id))
                             .join(PollOption).join(PollQuestion)
                             .where(PollQuestion.poll_id == poll.id)
                             .group_by(PollSelection.option_id)).all())
    mine = set(db.scalars(select(PollSelection.option_id).join(PollBallot)
                         .where(PollBallot.poll_id == poll.id, PollBallot.user_id == user.id)))
    participants = db.scalar(select(func.count(PollBallot.id)).where(PollBallot.poll_id == poll.id)) or 0
    grouped = defaultdict(list)
    for option in options:
        grouped[option.question_id].append({"id": option.id, "label": option.label,
                                           "media_id": option.media_id, "vote_count": counts.get(option.id, 0)})
    card_counts = dict(db.execute(select(PollOption.question_id, func.count(func.distinct(PollSelection.ballot_id)))
                                 .join(PollSelection, PollSelection.option_id == PollOption.id)
                                 .join(PollQuestion).where(PollQuestion.poll_id == poll.id)
                                 .group_by(PollOption.question_id)).all())
    all_closed = bool(questions) and all(closed(q) for q in questions)
    return {"id": poll.id, "post_id": poll.post_id, "revision": poll.revision,
            "ends_at": None, "closed_at": max((q.closed_at for q in questions), default=None) if all_closed else None, "is_closed": all_closed,
            "locked": poll.first_voted_at is not None, "participant_count": participants,
            "has_voted": bool(mine),
            "my_answers": [{"question_id": q.id, "option_ids": [o["id"] for o in grouped[q.id] if o["id"] in mine]} for q in questions],
            "questions": [{"id": q.id, "title": q.title, "kind": q.kind,
                           "allow_multiple": q.allow_multiple, "options": grouped[q.id],
                           "closed_at": q.closed_at, "is_closed": closed(q), "locked": q.first_voted_at is not None,
                           "participant_count": card_counts.get(q.id, 0),
                           "has_voted": any(o["id"] in mine for o in grouped[q.id]),
                           "legacy": q.kind != "text" or q.allow_multiple or len(grouped[q.id]) != 2 or any(o["media_id"] for o in grouped[q.id])}
                          for q in questions]}


def _structure(questions, options):
    return [(q.id, q.title, q.kind, q.allow_multiple,
             [(o.id, o.label, o.media_id) for o in options if o.question_id == q.id]) for q in questions]


def apply_poll_settings(db, post, board, user, draft: PollDraft | None, supplied: bool, removal_revision: int | None = None):
    existing = get_poll(db, post.id)
    if existing is not None or (supplied and draft is not None):
        # Serialize with board conversion/archival before trusting its current policy.
        board = db.scalar(select(Board).where(Board.id == board.id).with_for_update(read=True)
                          .execution_options(populate_existing=True))
    if existing is not None and board.board_type != "notice":
        fail("POLL_NOTICE_ONLY", "투표가 있는 글은 공지사항에서 관리해 주세요.")
    if not supplied:
        return
    require_admin(user)
    if draft is not None and board.board_type != "notice":
        fail("POLL_NOTICE_ONLY", "투표는 공지사항에만 추가할 수 있습니다.")
    if existing is not None and (draft is None or draft.revision != existing.revision):
        if draft is not None:
            fail("POLL_CHANGED", "투표가 변경되었습니다. 다시 불러와 주세요.", 409)
        if existing.first_voted_at is not None:
            fail("POLL_HAS_VOTES", "참여자가 있는 투표는 삭제할 수 없습니다.", 409)
    if draft is None:
        if existing is not None:
            existing_questions, _ = questions_and_options(db, existing)
            if any(closed(q) for q in existing_questions):
                fail("POLL_CLOSED", "종료한 투표는 삭제할 수 없습니다.", 409)
            if removal_revision != existing.revision:
                fail("POLL_CHANGED", "투표가 변경되었습니다. 다시 불러와 주세요.", 409)
            db.delete(existing)
            log_admin_action(db, actor_id=user.id, action="poll.remove", target_type="post", target_id=post.id)
        return
    questions, options = questions_and_options(db, existing) if existing else ([], [])
    incoming = [(q.id, q.title, q.kind, q.allow_multiple, [(o.id, o.label, o.media_id) for o in q.options]) for q in draft.questions]
    changed = _structure(questions, options) != incoming
    q_by_id = {q.id: q for q in questions}
    incoming_by_id = {q.id: q for q in draft.questions if q.id is not None}
    for stored in questions:
        proposed = incoming_by_id.get(stored.id)
        old = _structure([stored], options)[0]
        new = (proposed.id, proposed.title, proposed.kind, proposed.allow_multiple,
               [(o.id, o.label, o.media_id) for o in proposed.options]) if proposed else None
        if old != new:
            if stored.first_voted_at is not None:
                fail("POLL_HAS_VOTES", "참여자가 있는 투표의 제목과 항목은 변경하거나 삭제할 수 없습니다.", 409)
            if closed(stored):
                fail("POLL_CLOSED", "종료된 투표는 변경하거나 삭제할 수 없습니다.", 409)
    for proposed in draft.questions:
        previous = q_by_id.get(proposed.id)
        old = _structure([previous], options)[0] if previous else None
        new = (proposed.id, proposed.title, proposed.kind, proposed.allow_multiple, [(o.id, o.label, o.media_id) for o in proposed.options])
        if old != new and (proposed.kind != "text" or proposed.allow_multiple or len(proposed.options) != 2 or any(o.media_id for o in proposed.options)):
            fail("POLL_BINARY_ONLY", "참석 투표는 두 개의 텍스트 항목 중 하나만 선택합니다.")
    question_ids = {q.id for q in questions}
    option_ids = {o.id: o.question_id for o in options}
    seen_q, seen_o = set(), set()
    for q in draft.questions:
        if q.id is not None and (q.id not in question_ids or q.id in seen_q):
            fail("INVALID_POLL_OPTIONS", "질문 정보를 다시 확인해 주세요.")
        seen_q.add(q.id)
        for o in q.options:
            if o.id is not None and (option_ids.get(o.id) != q.id or o.id in seen_o):
                fail("INVALID_POLL_OPTIONS", "선택항목 정보를 다시 확인해 주세요.")
            seen_o.add(o.id)
            if o.media_id:
                media = db.get(MediaAsset, o.media_id)
                if media is None or media.status != "ready" or media.is_private or not media.content_type.startswith("image/"):
                    fail("INVALID_POLL_MEDIA", "준비 완료된 공개 범위의 이미지 파일을 선택해 주세요.")
    if existing is None:
        existing = PostPoll(post_id=post.id)
        db.add(existing)
        db.flush()
    elif not changed:
        return
    else:
        existing.revision += 1
    # Preserve stable IDs for retained questions/options; votes prevent changes above.
    q_by_id, o_by_id = {q.id: q for q in questions}, {o.id: o for o in options}
    kept_q, kept_o = set(), set()
    for index, q in enumerate(draft.questions):
        stored_q = q_by_id.get(q.id) or PollQuestion(poll_id=existing.id)
        stored_q.title, stored_q.kind, stored_q.allow_multiple, stored_q.sort_order = q.title, q.kind, q.allow_multiple, index
        db.add(stored_q)
        db.flush()
        kept_q.add(stored_q.id)
        for position, o in enumerate(q.options):
            stored_o = o_by_id.get(o.id) or PollOption(question_id=stored_q.id)
            stored_o.label, stored_o.media_id, stored_o.sort_order = o.label, o.media_id, position
            db.add(stored_o)
            db.flush()
            kept_o.add(stored_o.id)
    for o in options:
        if o.id not in kept_o:
            db.delete(o)
    for q in questions:
        if q.id not in kept_q:
            db.delete(q)
    existing.updated_at = utc_now()
    log_admin_action(db, actor_id=user.id, action="poll.update" if questions else "poll.create",
                     target_type="post", target_id=post.id, details={"poll_id": existing.id, "question_count": len(draft.questions)})


def submit_vote(db, post_id, user, payload: PollVote):
    # Account deletion also locks the user before any authored posts.
    active = db.scalar(select(User).where(User.id == user.id, User.is_active.is_(True)).with_for_update())
    if active is None:
        fail("UNAUTHORIZED", "다시 로그인해 주세요.", 401)
    post, board, poll = readable_poll(db, post_id, user, lock=True)
    if not board.is_active or post.status != "published":
        fail("NOT_FOUND", "진행 중인 공지를 찾을 수 없습니다.", 404)
    if payload.revision != poll.revision:
        fail("POLL_CHANGED", "투표가 변경되었습니다. 다시 확인해 주세요.", 409)
    questions, options = questions_and_options(db, poll)
    by_question = {q.id: q for q in questions}
    by_option = {o.id: o for o in options}
    requested_ids = [a.question_id for a in payload.answers]
    if len(set(requested_ids)) != len(requested_ids) or any(qid not in by_question for qid in requested_ids):
        fail("INVALID_POLL_OPTIONS", "이 공지의 투표를 선택해 주세요.")
    for answer in payload.answers:
        q = by_question[answer.question_id]
        if closed(q):
            fail("POLL_CLOSED", "투표가 종료되었습니다.", 409)
        card_options = [o for o in options if o.question_id == q.id]
        if q.kind != "text" or q.allow_multiple or len(card_options) != 2 or any(o.media_id for o in card_options):
            fail("POLL_LEGACY_READ_ONLY", "기존 형식의 투표는 결과만 확인할 수 있습니다.", 409)
        if len(answer.option_ids) != 1:
            fail("INVALID_POLL_OPTIONS", "선택항목 개수를 확인해 주세요.")
        if any(oid not in by_option or by_option[oid].question_id != q.id for oid in answer.option_ids):
            fail("INVALID_POLL_OPTIONS", "이 질문의 항목을 선택해 주세요.")
    ballot = db.scalar(select(PollBallot).where(PollBallot.poll_id == poll.id, PollBallot.user_id == user.id))
    if ballot is None:
        ballot = PollBallot(poll_id=poll.id, user_id=user.id)
        db.add(ballot)
        db.flush()
    replacement_ids = [o.id for o in options if o.question_id in requested_ids]
    db.execute(delete(PollSelection).where(PollSelection.ballot_id == ballot.id, PollSelection.option_id.in_(replacement_ids)))
    db.add_all([PollSelection(ballot_id=ballot.id, option_id=oid) for a in payload.answers for oid in a.option_ids])
    ballot.updated_at = utc_now()
    if poll.first_voted_at is None:
        poll.first_voted_at = utc_now()
    for qid in requested_ids:
        if by_question[qid].first_voted_at is None:
            by_question[qid].first_voted_at = utc_now()
    db.flush()
    return poll
