from datetime import datetime, timezone
from typing import Any


def _serialize_utc_datetimes(value: Any) -> Any:
    if isinstance(value, datetime):
        utc_value = (
            value.replace(tzinfo=timezone.utc)
            if value.tzinfo is None
            else value.astimezone(timezone.utc)
        )
        return utc_value.isoformat().replace("+00:00", "Z")
    if isinstance(value, dict):
        return {key: _serialize_utc_datetimes(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_serialize_utc_datetimes(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_serialize_utc_datetimes(item) for item in value)
    return value


def success_response(data: Any, pagination: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"status": "success", "data": _serialize_utc_datetimes(data)}
    if pagination is not None:
        payload["pagination"] = _serialize_utc_datetimes(pagination)
    return payload


def error_response(message: str, code: str, data: Any = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"status": "error", "message": message, "code": code}
    if data is not None:
        payload["data"] = _serialize_utc_datetimes(data)
    return payload
