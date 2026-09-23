from app import dues_payment_service


class _Dialect:
    def __init__(self, name: str) -> None:
        self.name = name


class _Bind:
    def __init__(self, dialect_name: str) -> None:
        self.dialect = _Dialect(dialect_name)


class _RecordingSession:
    def __init__(self, dialect_name: str = "postgresql") -> None:
        self.statements: list[str] = []
        self.bind = _Bind(dialect_name)

    def get_bind(self):
        return self.bind

    def execute(self, statement) -> None:
        self.statements.append(str(statement))


def test_dues_mutation_lock_uses_one_postgres_transaction_advisory_lock() -> None:
    lock = getattr(dues_payment_service, "lock_dues_mutation", None)
    assert lock is not None
    session = _RecordingSession()

    lock(session)

    assert len(session.statements) == 1
    assert "pg_advisory_xact_lock" in session.statements[0]
    assert "aisw-dues-payer-mutations" in session.statements[0]


def test_dues_mutation_lock_is_a_noop_outside_postgres() -> None:
    lock = getattr(dues_payment_service, "lock_dues_mutation", None)
    assert lock is not None
    session = _RecordingSession("sqlite")

    lock(session)

    assert session.statements == []
