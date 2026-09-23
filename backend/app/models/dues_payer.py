"""Temporary import bridge while backend consumers move to the split models.

The compatibility name is removed after the activity and admin routes are
migrated. It intentionally exposes roster identity only; payment state now
lives in :mod:`app.models.dues_payment`.
"""

from app.models.student_roster import StudentRosterMember


DuesPayer = StudentRosterMember
