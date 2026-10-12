import logging

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.response import error_response
from app.monitoring import send_operational_alert

logger = logging.getLogger(__name__)


class AppException(Exception):
    def __init__(
        self,
        status_code: int,
        message: str,
        code: str,
        headers: dict[str, str] | None = None,
        data: dict | None = None,
    ):
        self.status_code = status_code
        self.message = message
        self.code = code
        self.headers = headers
        self.data = data


def app_exception_handler(_, exc: AppException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.message, exc.code, exc.data),
        headers=exc.headers,
    )


def request_validation_exception_handler(_: Request, __: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_response("Request validation failed.", "VALIDATION_ERROR"),
    )


def _http_error_code(status_code: int) -> str:
    if status_code >= 500:
        return "INTERNAL_ERROR"
    return {
        400: "BAD_REQUEST",
        401: "UNAUTHORIZED",
        403: "FORBIDDEN",
        404: "NOT_FOUND",
        405: "METHOD_NOT_ALLOWED",
        409: "CONFLICT",
        413: "PAYLOAD_TOO_LARGE",
        415: "UNSUPPORTED_MEDIA_TYPE",
        422: "VALIDATION_ERROR",
        429: "RATE_LIMITED",
        503: "SERVICE_UNAVAILABLE",
    }.get(status_code, "HTTP_ERROR")


def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    if exc.status_code >= 500:
        message = "Internal server error."
    elif isinstance(exc.detail, str):
        message = exc.detail
    else:
        message = "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(message, _http_error_code(exc.status_code)),
        headers=exc.headers,
    )


def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception for %s %s",
        request.method,
        request.url.path,
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    route = request.scope.get("route")
    send_operational_alert(
        "api.unhandled_exception",
        context={
            "method": request.method,
            "route": getattr(route, "path", "unmatched"),
            "error_type": type(exc).__name__,
        },
    )
    return JSONResponse(
        status_code=500,
        content=error_response("Internal server error.", "INTERNAL_ERROR"),
    )
