from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.account_deletion import purge_account_deletion_staging_files, purge_expired_account_deletion_receipts
from app.config import settings
from app.database import SessionLocal
from app.deps import get_db
from app.errors import (
    AppException,
    app_exception_handler,
    http_exception_handler,
    request_validation_exception_handler,
    unhandled_exception_handler,
)
from app import models  # noqa: F401
from app.routers import admin, auth, banners, users, boards, posts, comments, dues_payers, events, faqs, media, notifications, registration, reports, search
from app.response import success_response
from app.routers import usage
from app.routers import polls
from app.seed import seed_initial_data, seed_reference_data

API_DESCRIPTION = """
AI·SW CAMPUS backend.

This API covers authentication, profile management, board posts, comments,
attachments, reports, notifications, Expo push tokens, search, events, FAQ,
and student council suggestion replies.
"""

OPENAPI_TAGS = [
    {"name": "auth", "description": "Login, registration verification, refresh, logout, and password reset."},
    {"name": "users", "description": "My profile, password change, and account deletion."},
    {"name": "boards", "description": "Board groups and board metadata."},
    {"name": "banners", "description": "Home banner list and admin banner management."},
    {"name": "posts", "description": "Board posts, detail, pinning, likes, bookmarks, and suggestion replies."},
    {"name": "comments", "description": "Comments, replies, edit, and delete."},
    {"name": "media", "description": "File upload and media metadata."},
    {"name": "reports", "description": "Post/comment reporting and admin notification creation."},
    {"name": "notifications", "description": "Notification list, read state, preferences, and push tokens."},
    {"name": "search", "description": "Post search and recent search keywords."},
    {"name": "events", "description": "Academic and student council schedule events."},
    {"name": "faqs", "description": "FAQ list and admin FAQ management."},
    {"name": "admin", "description": "Operational statistics and audit logs."},
    {"name": "registration", "description": "Public signup options and protected administrator configuration."},
    {"name": "dues-payers", "description": "Dues payer roster search and administrator management."},
]


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.validate_runtime()
    db = SessionLocal()
    try:
        if settings.uses_demo_seed:
            seed_initial_data(db)
        else:
            seed_reference_data(db)
        media.migrate_private_files(db)
        purge_account_deletion_staging_files()
        purge_expired_account_deletion_receipts(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=API_DESCRIPTION,
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
)


@app.middleware("http")
async def prevent_auth_response_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/auth/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
    return response


app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(RequestValidationError, request_validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=settings.trusted_hosts(),
    www_redirect=False,
)

app.include_router(users.router, prefix="/api/users", tags=["users"])
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(registration.router, prefix="/api/registration", tags=["registration"])
app.include_router(dues_payers.router, prefix="/api/dues-payers", tags=["dues-payers"])
app.include_router(boards.router, prefix="/api/boards", tags=["boards"])
app.include_router(banners.router, prefix="/api/banners", tags=["banners"])
app.include_router(posts.router, prefix="/api", tags=["posts"])
app.include_router(polls.router, prefix="/api", tags=["posts"])
app.include_router(comments.router, prefix="/api", tags=["comments"])
app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(events.router, prefix="/api/events", tags=["events"])
app.include_router(faqs.router, prefix="/api/faqs", tags=["faqs"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(media.router, prefix="/api/media", tags=["media"])
app.include_router(reports.router, prefix="/api", tags=["reports"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(usage.router, prefix="/api/usage", tags=["usage"])


@app.get("/health")
def health_check():
    return {"status": "success", "data": {"ok": True}}


@app.get("/health/ready")
def readiness_check(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return success_response({"ok": True, "database": "ready"})


@app.get("/api-docs", include_in_schema=False)
def api_docs_landing() -> HTMLResponse:
    return HTMLResponse(
        """
        <!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>AI·SW CAMPUS API Docs</title>
            <style>
              body {
                margin: 0;
                background: #f4f7fb;
                color: #111827;
                font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
              }
              main {
                max-width: 920px;
                margin: 0 auto;
                padding: 48px 20px;
              }
              h1 {
                color: #112d4e;
                font-size: 36px;
                margin: 0 0 10px;
              }
              p {
                color: #475569;
                line-height: 1.6;
              }
              .grid {
                display: grid;
                gap: 14px;
                grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                margin-top: 28px;
              }
              a {
                display: block;
                border: 1px solid #dbe3ef;
                border-radius: 8px;
                background: #fff;
                padding: 18px;
                color: #112d4e;
                text-decoration: none;
                font-weight: 800;
                box-shadow: 0 10px 24px rgba(17, 45, 78, 0.06);
              }
              a span {
                display: block;
                color: #64748b;
                font-size: 13px;
                font-weight: 600;
                margin-top: 8px;
              }
              code {
                background: #e8eef7;
                border-radius: 6px;
                padding: 2px 6px;
              }
            </style>
          </head>
          <body>
            <main>
              <h1>AI·SW CAMPUS API Docs</h1>
              <p>
                Backend documentation hub for the community app. Use Swagger for interactive testing,
                ReDoc for a clean reference view, and OpenAPI JSON for tooling.
              </p>
              <p>API base path: <code>/api</code></p>
              <section class="grid">
                <a href="/docs">Swagger UI<span>Interactive API tester</span></a>
                <a href="/redoc">ReDoc<span>Readable API reference</span></a>
                <a href="/openapi.json">OpenAPI JSON<span>Machine-readable schema</span></a>
                <a href="/health">Health Check<span>Runtime status endpoint</span></a>
              </section>
            </main>
          </body>
        </html>
        """
    )

