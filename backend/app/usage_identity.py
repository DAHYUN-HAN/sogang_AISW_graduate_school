import hashlib
import hmac

from app.config import settings


def usage_visitor_key(user_id: int) -> str:
    return hmac.new(settings.auth_secret_key.encode(), f"usage:{user_id}".encode(), hashlib.sha256).hexdigest()
