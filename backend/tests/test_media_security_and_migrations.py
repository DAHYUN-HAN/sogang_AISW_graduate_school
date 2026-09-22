from __future__ import annotations

import io
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
import zipfile

import pytest
from sqlalchemy import select
from sqlalchemy.dialects import postgresql

from app import migrate
from app.config import settings
from app.errors import AppException
from app.main import app
from app.media_service import media_file_signature, normalize_original_filename
from app.models.banner import Banner
from app.models.board import Board
from app.models.media import MediaAsset, PostAttachment
from app.models.post import Post
from app.models.post_extension import PostMutualAid
from app.models.user import User
from app.routers import media as media_router


PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"test-image-body"
PDF_BYTES = b"%PDF-1.7\n% test document\n"
HWP_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + (b"\x00" * 128) + b"HWP Document File"
OLE_DOCUMENT_BYTES = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + (b"\x00" * 256)


class FakeInspector:
    def __init__(self, schema_by_table: dict[str, dict]):
        self.schema_by_table = schema_by_table

    def get_table_names(self) -> list[str]:
        return list(self.schema_by_table)

    def get_columns(self, table_name: str) -> list[dict]:
        return self.schema_by_table[table_name]["columns"]

    def get_pk_constraint(self, table_name: str) -> dict:
        return self.schema_by_table[table_name]["primary_key"]

    def get_foreign_keys(self, table_name: str) -> list[dict]:
        return self.schema_by_table[table_name]["foreign_keys"]

    def get_unique_constraints(self, table_name: str) -> list[dict]:
        return self.schema_by_table[table_name]["unique_constraints"]


def _postgresql_type(column: migrate.ColumnSignature):
    if column.type_name == "integer":
        return postgresql.INTEGER()
    if column.type_name == "varchar":
        return postgresql.VARCHAR(length=column.length)
    if column.type_name == "text":
        return postgresql.TEXT()
    if column.type_name == "boolean":
        return postgresql.BOOLEAN()
    if column.type_name == "timestamp":
        return postgresql.TIMESTAMP(timezone=False)
    raise AssertionError(f"Missing reflected-type fixture for {column.type_name}")


def _postgresql_default(column: migrate.ColumnSignature) -> str | None:
    default = column.server_default
    if default is None:
        return None
    if default.startswith("sequence:"):
        sequence_name = default.removeprefix("sequence:")
        return f"""nextval('"public".{sequence_name}'::regclass)"""
    if default == "now":
        return "CURRENT_TIMESTAMP"
    if default.startswith("boolean:"):
        value = default.removeprefix("boolean:")
        return f"('{value}'::boolean)"
    if default.startswith("integer:"):
        value = default.removeprefix("integer:")
        return f"('{value}'::integer)"
    if default.startswith("string:"):
        value = default.removeprefix("string:").replace("'", "''")
        return f"'{value}'::character varying"
    raise AssertionError(f"Missing reflected-default fixture for {default}")


def _exact_phase1_reflection() -> dict[str, dict]:
    reflected: dict[str, dict] = {}
    for table_name, table in migrate.LEGACY_PHASE1_SIGNATURE.items():
        reflected[table_name] = {
            # Reflection order and generated constraint names are not stable.
            "columns": [
                {
                    "name": column_name,
                    "type": _postgresql_type(column),
                    "nullable": column.nullable,
                    "default": _postgresql_default(column),
                    "autoincrement": column.autoincrement,
                }
                for column_name, column in reversed(table.columns)
            ],
            "primary_key": {
                "name": f"{table_name}_pkey",
                "constrained_columns": list(table.primary_key),
            },
            "foreign_keys": [
                {
                    "name": f"{table_name}_{index}_fkey",
                    "constrained_columns": list(foreign_key.constrained_columns),
                    "referred_schema": "public",
                    "referred_table": foreign_key.referred_table,
                    "referred_columns": list(foreign_key.referred_columns),
                    "options": {"ondelete": foreign_key.ondelete or "NO ACTION"},
                }
                for index, foreign_key in enumerate(reversed(table.foreign_keys))
            ],
            "unique_constraints": [
                {
                    "name": f"{table_name}_{index}_key",
                    "column_names": list(columns),
                }
                for index, columns in enumerate(reversed(table.unique_constraints))
            ],
        }
    return reflected


def _reflected_column(schema: dict[str, dict], table_name: str, column_name: str) -> dict:
    return next(column for column in schema[table_name]["columns"] if column["name"] == column_name)


@pytest.fixture
def media_storage(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> tuple[Path, Path]:
    public_directory = tmp_path / "public"
    private_directory = tmp_path / "private"
    monkeypatch.setattr(settings, "media_upload_dir", public_directory)
    monkeypatch.setattr(settings, "media_private_upload_dir", private_directory)
    monkeypatch.setattr(settings, "media_upload_max_bytes", 1024)
    monkeypatch.setattr(settings, "media_upload_chunk_bytes", 4096)
    monkeypatch.setattr(settings, "media_access_url_expire_seconds", 60)
    monkeypatch.setattr(media_router, "enforce_rate_limit", lambda *_args, **_kwargs: None)
    return public_directory, private_directory


def _upload(
    api,
    *,
    actor: str = "owner",
    filename: str = "photo.png",
    body: bytes = PNG_BYTES,
    content_type: str = "image/png",
    private: bool = False,
):
    return api.client.post(
        "/api/media/uploads",
        files={"file": (filename, body, content_type)},
        data={"private": str(private).lower()},
        headers=api.headers[actor],
    )


def _signed_file_response(api, access_response):
    signed_url = access_response.json()["data"]["url"]
    return api.client.get(signed_url)


def _zip_bytes() -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("answer.txt", "exam answer")
    return output.getvalue()


def _openxml_bytes(marker: str) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr(marker, "<document />")
    return output.getvalue()


def test_media_upload_rate_limit_applies_to_members_but_not_admins(
    api,
    media_storage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def reject_existing_member_limit(
        _request,
        *,
        action: str,
        subject: str,
        limit: int,
        ip_limit: int,
        window_seconds: int,
    ) -> None:
        assert action == "media.upload"
        assert subject == "1"
        assert limit == 20
        assert ip_limit == 60
        assert window_seconds == 3600
        raise AppException(
            status_code=429,
            message="Too many requests.",
            code="RATE_LIMITED",
        )

    monkeypatch.setattr(media_router, "enforce_rate_limit", reject_existing_member_limit)

    member_response = _upload(api, actor="owner", filename="member-photo.png")
    admin_response = _upload(api, actor="admin", filename="admin-photo.png")

    assert member_response.status_code == 429
    assert member_response.json()["code"] == "RATE_LIMITED"
    assert admin_response.status_code == 200
    assert admin_response.json()["data"]["original_filename"] == "admin-photo.png"


def test_admin_photo_album_accepts_twenty_images_and_rejects_twenty_one(
    api,
    media_storage,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def reject_any_rate_limited_upload(*_args, **_kwargs) -> None:
        raise AppException(
            status_code=429,
            message="Too many requests.",
            code="RATE_LIMITED",
        )

    monkeypatch.setattr(media_router, "enforce_rate_limit", reject_any_rate_limited_upload)

    with api.session() as db:
        board = Board(
            name="Photo album",
            slug="photo-album-twenty-images",
            category="community",
            board_type="album",
            read_permission="user",
            write_permission="admin",
        )
        db.add(board)
        db.commit()
        db.refresh(board)
        board_id = board.id

    uploads = [
        _upload(api, actor="admin", filename=f"album-{index:02d}.png")
        for index in range(1, 22)
    ]

    assert [response.status_code for response in uploads] == [200] * 21
    media_ids = [response.json()["data"]["id"] for response in uploads]

    created = api.client.post(
        f"/api/boards/{board_id}/posts",
        headers=api.headers["admin"],
        json={
            "title": "관리자 사진첩 20장",
            "content": "관리자 사진첩 20장",
            "attachment_ids": media_ids[:20],
            "is_anonymous": False,
        },
    )

    assert created.status_code == 200
    post_id = created.json()["data"]["id"]

    rejected_create = api.client.post(
        f"/api/boards/{board_id}/posts",
        headers=api.headers["admin"],
        json={
            "title": "관리자 사진첩 21장",
            "content": "관리자 사진첩 21장",
            "attachment_ids": media_ids,
            "is_anonymous": False,
        },
    )
    rejected_update = api.client.put(
        f"/api/posts/{post_id}",
        headers=api.headers["admin"],
        json={
            "title": "관리자 사진첩 21번째 추가",
            "content": "관리자 사진첩 21번째 추가",
            "attachment_ids": media_ids,
            "is_anonymous": False,
        },
    )

    assert rejected_create.status_code == 400
    assert rejected_create.json()["code"] == "ALBUM_IMAGE_LIMIT_EXCEEDED"
    assert rejected_update.status_code == 400
    assert rejected_update.json()["code"] == "ALBUM_IMAGE_LIMIT_EXCEEDED"

    detail = api.client.get(f"/api/posts/{post_id}", headers=api.headers["admin"])

    assert detail.status_code == 200
    attachments = detail.json()["data"]["attachments"]
    assert [attachment["id"] for attachment in attachments] == media_ids[:20]
    assert [attachment["original_filename"] for attachment in attachments] == [
        f"album-{index:02d}.png" for index in range(1, 21)
    ]


@pytest.mark.parametrize(
    ("filename", "content_type", "body"),
    [
        ("photo.jpg", "image/jpeg", b"\xff\xd8\xfftest-jpeg"),
        ("photo.jpeg", "image/jpeg", b"\xff\xd8\xfftest-jpeg"),
        ("photo.png", "image/png", PNG_BYTES),
        ("photo.gif", "image/gif", b"GIF89atest-gif"),
        ("photo.webp", "image/webp", b"RIFF\x04\x00\x00\x00WEBPtest"),
        ("photo.heic", "image/heic", b"\x00\x00\x00\x18ftypheic"),
        ("photo.heif", "image/heif", b"\x00\x00\x00\x18ftypheif"),
        ("handout.pdf", "application/pdf", PDF_BYTES),
        ("legacy.doc", "application/msword", OLE_DOCUMENT_BYTES),
        ("legacy.xls", "application/vnd.ms-excel", OLE_DOCUMENT_BYTES),
        ("legacy.ppt", "application/vnd.ms-powerpoint", OLE_DOCUMENT_BYTES),
        (
            "document.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            _openxml_bytes("word/document.xml"),
        ),
        (
            "workbook.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            _openxml_bytes("xl/workbook.xml"),
        ),
        (
            "slides.pptx",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            _openxml_bytes("ppt/presentation.xml"),
        ),
        ("exam.hwp", "application/x-hwp", HWP_BYTES),
        ("exam-materials.zip", "application/zip", _zip_bytes()),
        ("exam-notes.txt", "text/plain", "시험 자료\n".encode()),
        (
            "analysis.ipynb",
            "application/x-ipynb+json",
            json.dumps({"cells": [], "metadata": {}, "nbformat": 4, "nbformat_minor": 5}).encode(),
        ),
    ],
)
def test_upload_accepts_safe_images_documents_presentations_and_data_files(
    api,
    media_storage,
    filename: str,
    content_type: str,
    body: bytes,
) -> None:
    response = _upload(api, filename=filename, content_type=content_type, body=body)

    assert response.status_code == 200
    access = api.client.get(response.json()["data"]["url"], headers=api.headers["owner"])
    downloaded = _signed_file_response(api, access)
    assert downloaded.status_code == 200
    assert downloaded.content == body


@pytest.mark.parametrize(
    ("original_filename", "stored_filename", "content_type", "body", "expected_filename"),
    [
        ("legacy-15811068", "legacy-15811068.pdf", "application/pdf", PDF_BYTES, "legacy-15811068.pdf"),
        (
            "legacy-15811070",
            "legacy-15811070.docx",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            b"PK\x03\x04test-docx",
            "legacy-15811070.docx",
        ),
        ("already-named.pdf", "stored.pdf", "application/pdf", PDF_BYTES, "already-named.pdf"),
        ("legacy-unknown", "stored.bin", "application/octet-stream", b"unknown", "legacy-unknown"),
    ],
)
def test_signed_download_adds_missing_extension_without_renaming_valid_files(
    api,
    media_storage,
    original_filename: str,
    stored_filename: str,
    content_type: str,
    body: bytes,
    expected_filename: str,
) -> None:
    public_directory, _ = media_storage
    public_directory.mkdir(parents=True, exist_ok=True)
    (public_directory / stored_filename).write_bytes(body)
    with api.session() as db:
        media = MediaAsset(
            owner_id=1,
            original_filename=original_filename,
            stored_filename=stored_filename,
            content_type=content_type,
            file_size=len(body),
            url=None,
            is_private=False,
            status="ready",
        )
        db.add(media)
        db.flush()
        media.url = f"/api/media/{media.id}/access-url"
        media_id = media.id
        db.commit()

    access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["admin"])
    response = _signed_file_response(api, access)

    assert response.status_code == 200
    assert response.content == body
    assert response.headers["content-disposition"] == f'attachment; filename="{expected_filename}"'


def test_signed_download_corrects_legacy_hwp_response_without_mutating_media(
    api,
    media_storage,
) -> None:
    public_directory, _ = media_storage
    public_directory.mkdir(parents=True, exist_ok=True)
    stored_filename = "legacy-10946091.doc"
    stored_path = public_directory / stored_filename
    stored_path.write_bytes(HWP_BYTES)
    with api.session() as db:
        media = MediaAsset(
            owner_id=1,
            original_filename="legacy-10946091",
            stored_filename=stored_filename,
            content_type="application/msword",
            file_size=len(HWP_BYTES),
            url=None,
            is_private=False,
            status="ready",
        )
        db.add(media)
        db.flush()
        media.url = f"/api/media/{media.id}/access-url"
        media_id = media.id
        db.commit()

    access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["admin"])
    response = _signed_file_response(api, access)

    assert response.status_code == 200
    assert response.content == HWP_BYTES
    assert response.headers["content-type"] == "application/x-hwp"
    assert response.headers["content-disposition"] == 'attachment; filename="legacy-10946091.hwp"'
    assert stored_path.read_bytes() == HWP_BYTES
    with api.session() as db:
        unchanged = db.get(MediaAsset, media_id)
        assert unchanged.original_filename == "legacy-10946091"
        assert unchanged.stored_filename == stored_filename
        assert unchanged.content_type == "application/msword"
        assert unchanged.file_size == len(HWP_BYTES)


def test_upload_stream_validation_and_cleanup(api, media_storage, monkeypatch: pytest.MonkeyPatch) -> None:
    public_directory, _ = media_storage

    empty = _upload(api, body=b"")
    assert empty.status_code == 400
    assert empty.json()["code"] == "EMPTY_FILE"
    assert list(public_directory.glob("*")) == []

    extension_mismatch = _upload(api, filename="photo.jpg", content_type="image/png")
    assert extension_mismatch.status_code == 415
    assert extension_mismatch.json()["code"] == "MEDIA_TYPE_MISMATCH"
    assert list(public_directory.glob("*")) == []

    content_mismatch = _upload(api, body=PDF_BYTES)
    assert content_mismatch.status_code == 415
    assert content_mismatch.json()["code"] == "MEDIA_TYPE_MISMATCH"
    assert list(public_directory.glob("*")) == []

    unsupported = _upload(api, filename="payload.exe", body=b"MZ", content_type="application/octet-stream")
    assert unsupported.status_code == 415
    assert unsupported.json()["code"] == "UNSUPPORTED_MEDIA_TYPE"
    assert list(public_directory.glob("*")) == []

    monkeypatch.setattr(settings, "media_upload_max_bytes", 8)
    too_large = _upload(api)
    assert too_large.status_code == 413
    assert too_large.json()["code"] == "FILE_TOO_LARGE"
    assert list(public_directory.glob("*")) == []


def test_upload_accepts_exact_limit_and_rejects_one_byte_over_without_new_file(
    api, media_storage, monkeypatch: pytest.MonkeyPatch
) -> None:
    public_directory, _ = media_storage
    monkeypatch.setattr(settings, "media_upload_max_bytes", len(PNG_BYTES))

    accepted = _upload(api, body=PNG_BYTES)
    rejected = _upload(api, body=PNG_BYTES + b"x")

    assert accepted.status_code == 200
    assert rejected.status_code == 413
    assert rejected.json()["code"] == "FILE_TOO_LARGE"
    assert len(list(public_directory.glob("*.png"))) == 1
    assert list(public_directory.glob("*.uploading")) == []


def test_upload_returns_stable_reference_and_signed_file_needs_no_bearer(api, media_storage) -> None:
    public_directory, _ = media_storage
    uploaded = _upload(api)
    assert uploaded.status_code == 200
    payload = uploaded.json()["data"]
    assert payload["url"] == f"/api/media/{payload['id']}/access-url"
    assert payload["access_url"] == payload["url"]
    assert "signature=" not in payload["url"]
    assert len(list(public_directory.glob("*.png"))) == 1
    assert list(public_directory.glob("*.uploading")) == []
    with api.session() as db:
        stored_media = db.get(MediaAsset, payload["id"])
        assert stored_media.url == payload["url"]
        assert "signature=" not in stored_media.url
        expired_signature = media_file_signature(stored_media, 0)

    no_bearer = api.client.get(payload["access_url"])
    assert no_bearer.status_code == 401
    assert no_bearer.json()["code"] == "UNAUTHORIZED"
    assert not any(getattr(route, "path", None) == "/uploads" for route in app.routes)
    legacy_direct = api.client.get(f"/uploads/{payload['stored_filename']}")
    assert legacy_direct.status_code == 404
    assert legacy_direct.json()["code"] == "NOT_FOUND"

    owner_access = api.client.get(payload["access_url"], headers=api.headers["owner"])
    assert owner_access.status_code == 200
    file_response = _signed_file_response(api, owner_access)
    assert file_response.status_code == 200
    assert file_response.content == PNG_BYTES
    assert file_response.headers["x-content-type-options"] == "nosniff"

    signed_url = owner_access.json()["data"]["url"]
    parsed = urlsplit(signed_url)
    query = parse_qs(parsed.query)
    invalid_signature = "0" * 64
    denied = api.client.get(
        parsed.path,
        params={"expires": query["expires"][0], "signature": invalid_signature},
    )
    assert denied.status_code == 403
    expired = api.client.get(
        parsed.path,
        params={"expires": 0, "signature": expired_signature},
    )
    assert expired.status_code == 403


def test_post_media_reuses_post_read_policy_and_any_readable_link_allows(api, media_storage) -> None:
    uploaded = _upload(api)
    media_id = uploaded.json()["data"]["id"]
    with api.session() as db:
        db.add_all(
            [
                PostAttachment(post_id=4, media_id=media_id, sort_order=0),
                PostAttachment(post_id=3, media_id=media_id, sort_order=0),
            ]
        )
        db.commit()

    access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["other"])
    assert access.status_code == 200
    assert _signed_file_response(api, access).status_code == 200


def test_private_mutual_aid_media_allows_only_processing_owner_and_admin(api, media_storage) -> None:
    _, private_directory = media_storage
    uploaded = _upload(api, filename="evidence.pdf", body=PDF_BYTES, content_type="application/pdf", private=True)
    assert uploaded.status_code == 200
    payload = uploaded.json()["data"]
    media_id = payload["id"]
    assert len(list(private_directory.glob("*.pdf"))) == 1

    with api.session() as db:
        db.add(PostAttachment(post_id=1, media_id=media_id, sort_order=0))
        db.commit()

    # 증빙은 신청 글을 읽을 수 있는 원우라면 누구나 열 수 있다.
    other_access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["other"])
    assert other_access.status_code == 200
    assert _signed_file_response(api, other_access).content == PDF_BYTES

    owner_access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["owner"])
    assert owner_access.status_code == 200
    assert _signed_file_response(api, owner_access).content == PDF_BYTES

    admin_access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["admin"])
    assert admin_access.status_code == 200
    assert _signed_file_response(api, admin_access).content == PDF_BYTES


def test_mutual_aid_evidence_is_visible_to_everyone_and_editable_by_the_owner(api, media_storage) -> None:
    uploaded = _upload(
        api,
        filename="evidence.pdf",
        body=PDF_BYTES,
        content_type="application/pdf",
        private=True,
    )
    media_id = uploaded.json()["data"]["id"]
    with api.session() as db:
        post = db.get(Post, 1)
        post.metadata_json = {
            "event_date": "2026-08-01",
            "relation": "self",
            "proof_url": "https://example.com/private-proof",
        }
        db.add(PostAttachment(post_id=post.id, media_id=media_id, sort_order=0))
        db.commit()

    for actor in ("owner", "other", "admin"):
        detail = api.client.get("/api/posts/1", headers=api.headers[actor])
        assert detail.status_code == 200
        assert [item["id"] for item in detail.json()["data"]["attachments"]] == [media_id]
        assert detail.json()["data"]["metadata"]["proof_url"] == "https://example.com/private-proof"
        assert detail.json()["data"]["mutual_aid"]["has_evidence"] is True

    updated = api.client.put(
        "/api/posts/1",
        headers=api.headers["owner"],
        json={
            "title": "Private Need Alpha",
            "content": "Updated remarks",
            "category": "wedding",
            "metadata": {"event_date": "2026-08-01", "relation": "self"},
            # 작성자는 증빙을 직접 확인하므로 그대로 다시 보내면 유지된다.
            "attachment_ids": [media_id],
            "is_anonymous": False,
        },
    )
    assert updated.status_code == 200

    with api.session() as db:
        post = db.get(Post, 1)
        attachments = db.scalars(
            select(PostAttachment).where(PostAttachment.post_id == post.id)
        ).all()
        assert [attachment.media_id for attachment in attachments] == [media_id]
        # 파일 증빙으로 저장하면 기존 링크 증빙은 대체된다(증빙은 파일 또는 링크 중 하나).
        assert "proof_url" not in post.metadata_json


def _attach_evidence(api, *, actor="owner", private=True, filename="evidence.pdf"):
    uploaded = _upload(api, actor=actor, filename=filename, body=PDF_BYTES, content_type="application/pdf", private=private)
    assert uploaded.status_code == 200
    media_id = uploaded.json()["data"]["id"]
    with api.session() as db:
        post = db.get(Post, 1)
        post.category = "wedding"
        post.metadata_json = {
            "event_date": "2026-08-01",
            "relation": "self",
            "proof_url": "https://example.com/private-proof",
        }
        db.add(PostAttachment(post_id=1, media_id=media_id, sort_order=media_id))
        db.commit()
    return media_id


def _evidence_edit_payload(attachment_ids, proof_url=""):
    return {
        "title": "Updated request",
        "content": "Updated remarks",
        "category": "wedding",
        "metadata": {"event_date": "2026-08-01", "relation": "self", "proof_url": proof_url},
        "attachment_ids": attachment_ids,
        "replace_evidence": True,
    }


def test_evidence_is_visible_only_in_authorized_edit_detail(api, media_storage) -> None:
    media_id = _attach_evidence(api, actor="admin")
    for actor in ("owner", "other"):
        detail = api.client.get("/api/posts/1", headers=api.headers[actor]).json()["data"]
        assert detail["attachments"] == []
        assert "proof_url" not in detail["metadata"]
        listed = api.client.get("/api/boards/1/posts", headers=api.headers[actor]).json()["data"]
        listed_post = next(post for post in listed if post["id"] == 1)
        assert "proof_url" not in listed_post["metadata"]
        assert listed_post["attachment_count"] == 0
    for actor in ("owner", "admin"):
        response = api.client.get("/api/posts/1?for_edit=true", headers=api.headers[actor])
        assert response.status_code == 200
        detail = response.json()["data"]
        assert [item["id"] for item in detail["attachments"]] == [media_id]
        assert detail["metadata"]["proof_url"] == "https://example.com/private-proof"
    peer = api.client.get("/api/posts/1?for_edit=true", headers=api.headers["other"])
    assert peer.status_code == 403
    assert api.client.get("/api/posts/1?for_edit=true").status_code == 401


def test_regular_post_edit_detail_requires_owner_or_admin(api) -> None:
    for actor in ("owner", "admin"):
        assert api.client.get("/api/posts/3?for_edit=true", headers=api.headers[actor]).status_code == 200
    assert api.client.get("/api/posts/3?for_edit=true", headers=api.headers["other"]).status_code == 403


@pytest.mark.parametrize("state", ["completed", "rejected", "deleted", "inactive_board", "restricted_board", "missing_extension"])
@pytest.mark.parametrize("private", [True, False])
def test_evidence_access_fails_closed_after_request_becomes_uneditable(api, media_storage, state, private) -> None:
    media_id = _attach_evidence(api, private=private)
    initial = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["owner"])
    assert initial.status_code == 200
    with api.session() as db:
        mutual_aid = db.scalar(select(PostMutualAid).where(PostMutualAid.post_id == 1))
        post = db.get(Post, 1)
        board = db.get(Board, 1)
        if state in {"completed", "rejected"}:
            mutual_aid.status = state
        elif state == "deleted":
            from app.security import utc_now
            post.deleted_at = utc_now()
        elif state == "inactive_board":
            board.is_active = False
        elif state == "restricted_board":
            board.read_permission = "admin"
        else:
            db.delete(mutual_aid)
        media = db.get(MediaAsset, media_id)
        legacy_path = f"/uploads/{media.stored_filename}"
        db.commit()
    for actor in ("owner", "other"):
        assert api.client.get(f"/api/media/{media_id}", headers=api.headers[actor]).status_code == 404
        assert api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers[actor]).status_code == 404
        assert api.client.get("/api/media/access-url", params={"path": legacy_path}, headers=api.headers[actor]).status_code == 404
    edit = api.client.get("/api/posts/1?for_edit=true", headers=api.headers["owner"])
    assert edit.status_code in {400, 404}
    update = api.client.put("/api/posts/1", headers=api.headers["owner"], json=_evidence_edit_payload([media_id]))
    assert update.status_code in {400, 404}
    admin = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["admin"])
    assert admin.status_code == 200
    assert _signed_file_response(api, admin).content == PDF_BYTES


def test_legacy_public_evidence_cannot_escape_policy_through_regular_post_or_profile(api, media_storage) -> None:
    media_id = _attach_evidence(api, private=False)
    with api.session() as db:
        media = db.get(MediaAsset, media_id)
        db.add(PostAttachment(post_id=3, media_id=media_id, sort_order=1))
        db.get(User, 1).profile_image_url = media.url
        legacy_path = f"/uploads/{media.stored_filename}"
        db.commit()
    for path in (f"/api/media/{media_id}", f"/api/media/{media_id}/access-url", f"/api/media/{media_id}/download-link"):
        assert api.client.get(path, headers=api.headers["other"]).status_code == 404
    assert api.client.get("/api/media/access-url", params={"path": legacy_path}, headers=api.headers["other"]).status_code == 404
    access = api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["owner"])
    assert access.status_code == 200
    assert _signed_file_response(api, access).content == PDF_BYTES


@pytest.mark.parametrize("existing_actor,private", [("owner", True), ("admin", True), ("admin", False)])
def test_explicit_evidence_edit_retains_order_and_detaches_removed_files(api, media_storage, existing_actor, private) -> None:
    first = _attach_evidence(api, actor=existing_actor, private=private, filename="first.pdf")
    removed = _attach_evidence(api, filename="removed.pdf")
    last = _attach_evidence(api, filename="last.pdf")
    replacement = _upload(api, filename="replacement.pdf", body=PDF_BYTES, content_type="application/pdf", private=True).json()["data"]["id"]
    response = api.client.put("/api/posts/1", headers=api.headers["owner"], json=_evidence_edit_payload([last, first, replacement]))
    assert response.status_code == 200
    with api.session() as db:
        links = db.scalars(select(PostAttachment).where(PostAttachment.post_id == 1).order_by(PostAttachment.sort_order)).all()
        assert [link.media_id for link in links] == [last, first, replacement]
        assert db.get(Post, 1).metadata_json["proof_url"] == ""
        removed_media = db.get(MediaAsset, removed)
        assert removed_media is not None
        assert (media_storage[1] / removed_media.stored_filename).read_bytes() == PDF_BYTES


def test_explicit_evidence_edit_switches_files_and_link(api, media_storage) -> None:
    media_id = _attach_evidence(api)
    linked = api.client.put("/api/posts/1", headers=api.headers["owner"], json=_evidence_edit_payload([], "https://example.com/new-proof"))
    assert linked.status_code == 200
    detail = api.client.get("/api/posts/1?for_edit=true", headers=api.headers["owner"]).json()["data"]
    assert detail["attachments"] == []
    assert detail["metadata"]["proof_url"] == "https://example.com/new-proof"
    filed = api.client.put("/api/posts/1", headers=api.headers["owner"], json=_evidence_edit_payload([media_id]))
    assert filed.status_code == 200
    detail = api.client.get("/api/posts/1?for_edit=true", headers=api.headers["owner"]).json()["data"]
    assert [item["id"] for item in detail["attachments"]] == [media_id]
    assert detail["metadata"]["proof_url"] == ""


@pytest.mark.parametrize("invalid", ["empty", "invalid_link", "missing_ids", "missing_proof_url", "invalid_id", "foreign_id", "public_id"])
def test_invalid_explicit_evidence_edit_preserves_existing_request(api, media_storage, invalid) -> None:
    media_id = _attach_evidence(api)
    payload = _evidence_edit_payload([])
    if invalid == "invalid_link":
        payload["metadata"]["proof_url"] = "javascript:alert(1)"
    elif invalid == "missing_ids":
        del payload["attachment_ids"]
    elif invalid == "missing_proof_url":
        payload["attachment_ids"] = [media_id]
        del payload["metadata"]["proof_url"]
    elif invalid == "invalid_id":
        payload["attachment_ids"] = [999999]
    elif invalid in {"foreign_id", "public_id"}:
        uploaded = _upload(api, actor="other" if invalid == "foreign_id" else "owner", private=invalid != "public_id")
        payload["attachment_ids"] = [uploaded.json()["data"]["id"]]
    response = api.client.put("/api/posts/1", headers=api.headers["owner"], json=payload)
    assert response.status_code in {400, 422}
    with api.session() as db:
        post = db.get(Post, 1)
        assert post.title == "Private Need Alpha"
        assert post.metadata_json["proof_url"] == "https://example.com/private-proof"
        assert list(db.scalars(select(PostAttachment.media_id).where(PostAttachment.post_id == 1))) == [media_id]


@pytest.mark.parametrize("replace_evidence", [None, False])
def test_legacy_hidden_evidence_edit_still_preserves_existing_files(api, media_storage, replace_evidence) -> None:
    media_id = _attach_evidence(api)
    payload = _evidence_edit_payload([])
    del payload["metadata"]["proof_url"]
    if replace_evidence is None:
        del payload["replace_evidence"]
    else:
        payload["replace_evidence"] = replace_evidence
    response = api.client.put("/api/posts/1", headers=api.headers["owner"], json=payload)
    assert response.status_code == 200
    with api.session() as db:
        assert list(db.scalars(select(PostAttachment.media_id).where(PostAttachment.post_id == 1))) == [media_id]
        assert db.get(Post, 1).metadata_json["proof_url"] == "https://example.com/private-proof"


def test_profile_and_banner_references_are_member_readable_via_stable_and_legacy_paths(api, media_storage) -> None:
    profile_upload = _upload(api, filename="avatar.png")
    profile_payload = profile_upload.json()["data"]
    profile_id = profile_payload["id"]
    stable_reference = profile_payload["url"]

    saved_profile = api.client.put(
        "/api/users/me",
        json={"profile_image_url": stable_reference},
        headers=api.headers["owner"],
    )
    assert saved_profile.status_code == 200
    profile_response = api.client.get("/api/users/me", headers=api.headers["owner"])
    assert profile_response.json()["data"]["profile_image_url"] == stable_reference
    assert profile_response.json()["data"]["profile_image_media_id"] == profile_id

    stable_resolution = api.client.get(
        "/api/media/access-url",
        params={"path": stable_reference},
        headers=api.headers["other"],
    )
    assert stable_resolution.status_code == 200
    assert _signed_file_response(api, stable_resolution).status_code == 200

    with api.session() as db:
        profile_media = db.get(MediaAsset, profile_id)
        legacy_reference = f"/uploads/{profile_media.stored_filename}"
        owner = db.get(User, 1)
        owner.profile_image_url = legacy_reference
        db.commit()

    legacy_resolution = api.client.get(
        "/api/media/access-url",
        params={"path": legacy_reference},
        headers=api.headers["other"],
    )
    assert legacy_resolution.status_code == 200

    banner_upload = _upload(api, filename="banner.png")
    banner_payload = banner_upload.json()["data"]
    with api.session() as db:
        db.add(
            Banner(
                placement="home",
                image_url=banner_payload["url"],
                theme="blue",
                is_active=True,
                created_by=1,
            )
        )
        db.commit()

    banner_resolution = api.client.get(
        "/api/media/access-url",
        params={"path": banner_payload["url"]},
        headers=api.headers["other"],
    )
    assert banner_resolution.status_code == 200

    absolute_path = api.client.get(
        "/api/media/access-url",
        params={"path": "file:///etc/passwd"},
        headers=api.headers["owner"],
    )
    assert absolute_path.status_code == 422


def test_profile_image_update_canonicalizes_and_validates_media(api, media_storage) -> None:
    profile_upload = _upload(api, filename="avatar.png")
    profile_payload = profile_upload.json()["data"]
    with api.session() as db:
        profile_media = db.get(MediaAsset, profile_payload["id"])
        legacy_reference = f"/uploads/{profile_media.stored_filename}"

    legacy_update = api.client.put(
        "/api/users/me",
        json={"profile_image_url": legacy_reference},
        headers=api.headers["owner"],
    )
    assert legacy_update.status_code == 200
    profile = api.client.get("/api/users/me", headers=api.headers["owner"]).json()["data"]
    assert profile["profile_image_url"] == profile_payload["url"]
    assert profile["profile_image_media_id"] == profile_payload["id"]

    cleared = api.client.put(
        "/api/users/me",
        json={"profile_image_url": "   "},
        headers=api.headers["owner"],
    )
    assert cleared.status_code == 200
    cleared_profile = api.client.get("/api/users/me", headers=api.headers["owner"]).json()["data"]
    assert cleared_profile["profile_image_url"] is None
    assert cleared_profile["profile_image_media_id"] is None

    other_upload = _upload(api, actor="other", filename="other.png")
    private_upload = _upload(api, filename="private.png", private=True)
    document_upload = _upload(api, filename="profile.pdf", body=PDF_BYTES, content_type="application/pdf")
    invalid_references = [
        "https://example.com/avatar.png",
        other_upload.json()["data"]["url"],
        private_upload.json()["data"]["url"],
        document_upload.json()["data"]["url"],
        "/api/media/999999/access-url",
    ]
    for reference in invalid_references:
        response = api.client.put(
            "/api/users/me",
            json={"profile_image_url": reference},
            headers=api.headers["owner"],
        )
        assert response.status_code == 422
        assert response.json()["code"] == "VALIDATION_ERROR"


def test_active_readable_board_metadata_grants_member_media_access(api, media_storage) -> None:
    readable_upload = _upload(api, filename="leader.png")
    inactive_upload = _upload(api, filename="inactive.png")
    admin_only_upload = _upload(api, filename="admin-only.png")
    readable_reference = readable_upload.json()["data"]["url"]
    inactive_reference = inactive_upload.json()["data"]["url"]
    admin_only_reference = admin_only_upload.json()["data"]["url"]

    with api.session() as db:
        db.add_all(
            [
                Board(
                    id=10,
                    name="Cohort Leaders",
                    slug="cohort-leaders",
                    category="council",
                    board_type="organization_intro",
                    read_permission="user",
                    write_permission="admin",
                    metadata_json={
                        "cohort_leaders": [
                            {
                                "captain": {
                                    "profile": {
                                        "image_url": readable_reference,
                                    }
                                }
                            }
                        ]
                    },
                    is_active=True,
                ),
                Board(
                    id=11,
                    name="Inactive Leaders",
                    slug="inactive-leaders",
                    category="council",
                    board_type="organization_intro",
                    read_permission="user",
                    write_permission="admin",
                    metadata_json={"image_url": inactive_reference},
                    is_active=False,
                ),
                Board(
                    id=12,
                    name="Admin Files",
                    slug="admin-files",
                    category="council",
                    board_type="organization_intro",
                    read_permission="admin",
                    write_permission="admin",
                    metadata_json={"image_url": admin_only_reference},
                    is_active=True,
                ),
            ]
        )
        db.commit()

    readable = api.client.get(
        "/api/media/access-url",
        params={"path": readable_reference},
        headers=api.headers["other"],
    )
    assert readable.status_code == 200
    assert _signed_file_response(api, readable).status_code == 200

    inactive = api.client.get(
        "/api/media/access-url",
        params={"path": inactive_reference},
        headers=api.headers["other"],
    )
    assert inactive.status_code == 404
    admin_only = api.client.get(
        "/api/media/access-url",
        params={"path": admin_only_reference},
        headers=api.headers["other"],
    )
    assert admin_only.status_code == 404
    assert (
        api.client.get(
            "/api/media/access-url",
            params={"path": admin_only_reference},
            headers=api.headers["admin"],
        ).status_code
        == 200
    )


def test_unattached_media_is_owner_or_admin_only(api, media_storage) -> None:
    uploaded = _upload(api)
    media_id = uploaded.json()["data"]["id"]
    assert api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["other"]).status_code == 404
    assert api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["owner"]).status_code == 200
    assert api.client.get(f"/api/media/{media_id}/access-url", headers=api.headers["admin"]).status_code == 200


def test_migration_detection_handles_clean_versioned_and_exact_phase1() -> None:
    assert migrate.detect_unversioned_legacy_revision(FakeInspector({})) is None
    assert migrate.detect_unversioned_legacy_revision(FakeInspector({"alembic_version": {}})) is None
    exact_phase1 = _exact_phase1_reflection()
    assert migrate.detect_unversioned_legacy_revision(FakeInspector(exact_phase1)) == migrate.LEGACY_PHASE1_REVISION


def test_migration_runner_stamps_only_exact_legacy_then_upgrades(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[tuple[str, str]] = []
    monkeypatch.setattr(migrate.command, "stamp", lambda _config, revision: calls.append(("stamp", revision)))
    monkeypatch.setattr(migrate.command, "upgrade", lambda _config, revision: calls.append(("upgrade", revision)))
    exact_phase1 = _exact_phase1_reflection()

    migrate.run_migrations(inspector=FakeInspector(exact_phase1), config=object())
    assert calls == [("stamp", "0001_phase1_init"), ("upgrade", "head")]

    calls.clear()
    migrate.run_migrations(inspector=FakeInspector({}), config=object())
    assert calls == [("upgrade", "head")]


@pytest.mark.parametrize(
    "mismatch",
    [
        "column_name",
        "column_type",
        "column_length",
        "nullability",
        "sequence_default",
        "role_default",
        "boolean_default",
        "integer_default",
        "timestamp_default",
        "server_default_missing",
        "no_default_metadata_missing",
        "pk_autoincrement",
        "pk_autoincrement_missing",
        "primary_key",
        "foreign_key_ondelete",
        "unique_constraint",
    ],
)
def test_migration_detection_refuses_structural_mismatch_before_upgrade(
    monkeypatch: pytest.MonkeyPatch,
    mismatch: str,
) -> None:
    ambiguous = _exact_phase1_reflection()
    if mismatch == "column_name":
        ambiguous["users"]["columns"].append(
            {"name": "cohort", "type": postgresql.VARCHAR(length=20), "nullable": True}
        )
    elif mismatch == "column_type":
        _reflected_column(ambiguous, "users", "id")["type"] = postgresql.BIGINT()
    elif mismatch == "column_length":
        _reflected_column(ambiguous, "users", "username")["type"] = postgresql.VARCHAR(length=51)
    elif mismatch == "nullability":
        _reflected_column(ambiguous, "users", "username")["nullable"] = True
    elif mismatch == "sequence_default":
        _reflected_column(ambiguous, "users", "id")["default"] = "nextval('posts_id_seq'::regclass)"
    elif mismatch == "role_default":
        _reflected_column(ambiguous, "users", "role")["default"] = "'admin'::character varying"
    elif mismatch == "boolean_default":
        _reflected_column(ambiguous, "users", "is_active")["default"] = "false"
    elif mismatch == "integer_default":
        _reflected_column(ambiguous, "posts", "view_count")["default"] = "1"
    elif mismatch == "timestamp_default":
        _reflected_column(ambiguous, "users", "created_at")["default"] = "clock_timestamp()"
    elif mismatch == "server_default_missing":
        _reflected_column(ambiguous, "users", "role").pop("default")
    elif mismatch == "no_default_metadata_missing":
        _reflected_column(ambiguous, "users", "username").pop("default")
    elif mismatch == "pk_autoincrement":
        _reflected_column(ambiguous, "users", "id")["autoincrement"] = False
    elif mismatch == "pk_autoincrement_missing":
        _reflected_column(ambiguous, "users", "id").pop("autoincrement")
    elif mismatch == "primary_key":
        ambiguous["users"]["primary_key"]["constrained_columns"] = ["username"]
    elif mismatch == "foreign_key_ondelete":
        board_foreign_key = next(
            foreign_key
            for foreign_key in ambiguous["posts"]["foreign_keys"]
            if foreign_key["constrained_columns"] == ["board_id"]
        )
        board_foreign_key["options"]["ondelete"] = "CASCADE"
    elif mismatch == "unique_constraint":
        ambiguous["users"]["unique_constraints"] = [
            constraint
            for constraint in ambiguous["users"]["unique_constraints"]
            if constraint["column_names"] != ["username"]
        ]
    else:
        raise AssertionError(f"Unhandled mismatch fixture: {mismatch}")

    upgrade_called = False
    stamp_called = False

    def _upgrade(*_args, **_kwargs):
        nonlocal upgrade_called
        upgrade_called = True

    def _stamp(*_args, **_kwargs):
        nonlocal stamp_called
        stamp_called = True

    monkeypatch.setattr(migrate.command, "upgrade", _upgrade)
    monkeypatch.setattr(migrate.command, "stamp", _stamp)
    with pytest.raises(RuntimeError, match="Refusing to stamp an unversioned database"):
        migrate.run_migrations(inspector=FakeInspector(ambiguous), config=object())
    assert upgrade_called is False
    assert stamp_called is False


@pytest.mark.parametrize(
    ("sent", "expected"),
    [
        # RN FormData 가 encodeURIComponent 로 감싼 한글 파일명
        ("%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf", "보고서.pdf"),
        ("%ED%95%A0%EC%9D%B8%2050%25.pdf", "할인 50%.pdf"),
        # 브라우저가 보내는 날것의 한글은 그대로 둔다.
        ("보고서.pdf", "보고서.pdf"),
        # ASCII 범위 이스케이프만 있으면 진짜 파일명으로 보고 건드리지 않는다.
        ("50%20off.pdf", "50%20off.pdf"),
        # UTF-8 로 풀리지 않으면 되돌리지 않는다.
        ("%C0%80.pdf", "%C0%80.pdf"),
    ],
)
def test_normalize_original_filename_restores_react_native_percent_encoding(sent, expected):
    assert normalize_original_filename(sent) == expected
