from sqlalchemy import select

from app.models.auth import PasswordResetToken
from app.models.user import User


# 2026-10-15 회의 결정: 비밀번호 찾기에서 가입하지 않았거나 탈퇴한 이메일이면 알려 준다
# (Figma Screen/Auth/FindPassword-NotFound). 편의성을 계정 열거 방지보다 우선한다.
# 가입한 이메일의 코드 발급은 PostgreSQL 잠금을 써서 SQLite 테스트로는 확인하지 않는다.
def test_unknown_email_is_reported_without_issuing_a_code(api):
    response = api.client.post("/api/auth/password-reset/request", json={"email": "nobody@sogang.ac.kr"})
    assert response.status_code == 404
    assert response.json()["code"] == "ACCOUNT_NOT_FOUND"
    with api.session() as db:
        assert db.scalar(select(PasswordResetToken.id)) is None


def test_deactivated_account_is_reported_as_not_found(api):
    with api.session() as db:
        user = db.get(User, 1)
        user.is_active = False
        email = user.email
        db.commit()
    response = api.client.post("/api/auth/password-reset/request", json={"email": email})
    assert response.status_code == 404
    assert response.json()["code"] == "ACCOUNT_NOT_FOUND"

