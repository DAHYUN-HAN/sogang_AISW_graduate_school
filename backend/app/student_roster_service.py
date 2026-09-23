from sqlalchemy import select
from sqlalchemy.orm import Session

from app.dues_payer_import import DuesPayerRow
from app.models.student_roster import StudentRosterMember


def import_roster(db: Session, rows: list[DuesPayerRow]) -> dict[str, int]:
    student_numbers = [row.student_number for row in rows]
    existing = {
        item.student_number: item
        for item in db.scalars(
            select(StudentRosterMember)
            .where(StudentRosterMember.student_number.in_(student_numbers))
            .with_for_update()
        ).all()
    }

    created = 0
    updated = 0
    unchanged = 0
    for row in rows:
        item = existing.get(row.student_number)
        if item is None:
            db.add(
                StudentRosterMember(
                    name=row.name,
                    major=row.major,
                    student_number=row.student_number,
                )
            )
            created += 1
        elif (item.name, item.major) == (row.name, row.major):
            unchanged += 1
        else:
            item.name = row.name
            item.major = row.major
            updated += 1

    return {
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "total_rows": len(rows),
    }
