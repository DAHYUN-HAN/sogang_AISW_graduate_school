import math
from typing import Literal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.audit import log_admin_action
from app.deps import get_current_user, get_db, require_admin
from app.models.poll import PollBallot, PollOption, PollQuestion, PollSelection
from app.models.user import User
from app.polls import fail, readable_poll, serialize_poll, submit_vote, questions_and_options
from app.response import success_response
from app.schemas.poll import PollVote
from app.security import utc_now

router = APIRouter()


@router.get("/posts/{post_id}/poll")
def detail(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _, _, poll = readable_poll(db, post_id, user)
    return success_response(serialize_poll(db, poll, user))


@router.put("/posts/{post_id}/poll/vote")
def vote(post_id: int, payload: PollVote, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    poll = submit_vote(db, post_id, user, payload)
    db.commit()
    return success_response(serialize_poll(db, poll, user))


@router.post("/posts/{post_id}/poll/close")
def close(post_id: int, question_id: int | None = Query(None, ge=1), db: Session = Depends(get_db), user: User = Depends(require_admin)):
    _, _, poll = readable_poll(db, post_id, user, lock=True)
    questions, _ = questions_and_options(db, poll)
    targets = [q for q in questions if question_id is None or q.id == question_id]
    if not targets:
        fail("NOT_FOUND", "이 공지의 투표를 찾을 수 없습니다.", 404)
    changed = False
    for question in targets:
        if question.closed_at is None:
            question.closed_at = utc_now()
            changed = True
    if changed:
        log_admin_action(db, actor_id=user.id, action="poll.close", target_type="post", target_id=post_id,
                         details={"poll_id": poll.id, "question_ids": [q.id for q in targets]})
        db.commit()
    return success_response(serialize_poll(db, poll, user))


@router.get("/posts/{post_id}/poll/participants")
def participants(post_id: int, option_id: int | None = Query(None, ge=1),
                 question_id: int | None = Query(None, ge=1),
                 participation: Literal["voted", "not_voted"] = "voted",
                 page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
                 db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    post, board, poll = readable_poll(db, post_id, user)
    filters = [PollBallot.poll_id == poll.id]
    if question_id is not None:
        if db.scalar(select(PollQuestion.id).where(PollQuestion.id == question_id, PollQuestion.poll_id == poll.id)) is None:
            fail("INVALID_POLL_OPTIONS", "이 공지의 투표를 선택해 주세요.")
        filters.append(PollBallot.id.in_(select(PollSelection.ballot_id).join(PollOption)
                                        .where(PollOption.question_id == question_id)))
    if participation == "not_voted":
        if question_id is None or option_id is not None:
            fail("INVALID_POLL_OPTIONS", "미참여 현황은 투표를 선택하고 항목 필터 없이 확인해 주세요.")
        voters = select(PollBallot.user_id).join(PollSelection).join(PollOption).where(
            PollBallot.poll_id == poll.id, PollOption.question_id == question_id)
        eligible = [User.is_active.is_(True), User.id.not_in(voters)]
        if not board.is_active or board.read_permission not in {"guest", "user"}:
            eligible.append(User.role == "admin")
        if post.status != "published":
            eligible.append(or_(User.role == "admin", User.id == post.author_id))
        total = db.scalar(select(func.count(User.id)).where(*eligible)) or 0
        members = db.scalars(select(User).where(*eligible).order_by(User.cohort, User.nickname, User.id)
                             .offset((page - 1) * size).limit(size)).all()
        return success_response([{"user_id": member.id, "nickname": member.nickname, "cohort": member.cohort, "answers": []}
                                 for member in members], pagination={"page": page, "size": size, "total": total,
                                                                     "total_pages": math.ceil(total / size)})
    if option_id is not None:
        valid = db.scalar(select(PollOption.id).join(PollQuestion)
                          .where(PollQuestion.poll_id == poll.id, PollOption.id == option_id,
                                 PollQuestion.id == question_id if question_id is not None else True))
        if valid is None:
            fail("INVALID_POLL_OPTIONS", "이 투표의 항목을 선택해 주세요.")
        filters.append(PollBallot.id.in_(select(PollSelection.ballot_id).where(PollSelection.option_id == option_id)))
    total = db.scalar(select(func.count(PollBallot.id)).where(*filters)) or 0
    rows = db.execute(select(PollBallot, User).join(User, User.id == PollBallot.user_id)
                      .where(*filters).order_by(User.cohort, User.nickname, User.id)
                      .offset((page - 1) * size).limit(size)).all()
    selections = db.execute(select(PollSelection.ballot_id, PollOption, PollQuestion)
                            .join(PollOption, PollOption.id == PollSelection.option_id)
                            .join(PollQuestion, PollQuestion.id == PollOption.question_id)
                            .where(PollSelection.ballot_id.in_([b.id for b, _ in rows]))
                            .order_by(PollQuestion.sort_order, PollOption.sort_order)).all()
    result = []
    for ballot, member in rows:
        answers = [{"question_id": q.id, "question_title": q.title, "option_id": o.id, "label": o.label}
                   for bid, o, q in selections if bid == ballot.id and (question_id is None or q.id == question_id)]
        result.append({"user_id": member.id, "nickname": member.nickname, "cohort": member.cohort, "answers": answers})
    return success_response(result, pagination={"page": page, "size": size, "total": total,
                                               "total_pages": math.ceil(total / size)})
