from __future__ import annotations

import hashlib
import hmac
import json
import os
import re
import time
import zipfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import unquote, urlencode, urlsplit

from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import BACKEND_ROOT, settings
from app.deps import can_read_board
from app.errors import AppException
from app.models.banner import Banner
from app.models.board import Board
from app.models.faq import FAQ, FAQAttachment
from app.models.media import MediaAsset, PostAttachment
from app.models.post import Post
from app.models.post_extension import PostMutualAid
from app.models.user import User
from app.post_access import require_post_read
from app.security import generate_token_urlsafe, utc_now


MIME_EXTENSION_PAIRS: dict[str, frozenset[str]] = {
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/png": frozenset({".png"}),
    "image/gif": frozenset({".gif"}),
    "image/webp": frozenset({".webp"}),
    "image/heic": frozenset({".heic"}),
    "image/heif": frozenset({".heif"}),
    "application/pdf": frozenset({".pdf"}),
    "application/msword": frozenset({".doc"}),
    "application/vnd.ms-excel": frozenset({".xls"}),
    "application/vnd.ms-powerpoint": frozenset({".ppt"}),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": frozenset({".docx"}),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": frozenset({".xlsx"}),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": frozenset({".pptx"}),
    "application/x-hwp": frozenset({".hwp"}),
    "application/haansofthwp": frozenset({".hwp"}),
    "application/vnd.hancom.hwp": frozenset({".hwp"}),
    "application/zip": frozenset({".zip"}),
    "text/plain": frozenset({".txt"}),
    "application/x-ipynb+json": frozenset({".ipynb"}),
    "application/json": frozenset({".ipynb"}),
}
MIME_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "application/x-zip-compressed": "application/zip",
    "application/haansofthwp": "application/x-hwp",
    "application/vnd.hancom.hwp": "application/x-hwp",
}
OPENXML_MARKERS = {
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/",
}
OLE_MIME_TYPES = frozenset(
    {
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/x-hwp",
        "application/haansofthwp",
        "application/vnd.hancom.hwp",
    }
)
OLE_SIGNATURE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
HWP_DOCUMENT_SIGNATURE = b"HWP Document File"
STABLE_REFERENCE_RE = re.compile(r"^/api/media/(?P<media_id>[1-9]\d*)/access-url$")
LEGACY_UPLOAD_RE = re.compile(r"^/uploads/(?P<stored_filename>[^/\\]{1,255})$")


@dataclass(frozen=True)
class UploadDeclaration:
    original_filename: str
    content_type: str
    extension: str


@dataclass(frozen=True)
class StoredUpload:
    original_filename: str
    stored_filename: str
    content_type: str
    file_size: int
    path: Path


@dataclass(frozen=True)
class MediaDownload:
    filename: str
    content_type: str


def _csv_values(value: str) -> frozenset[str]:
    return frozenset(item.strip().lower() for item in value.split(",") if item.strip())


def _configured_directory(value: Path) -> Path:
    directory = value if value.is_absolute() else BACKEND_ROOT / value
    return directory.resolve()


def public_upload_directory() -> Path:
    return _configured_directory(settings.media_upload_dir)


def private_upload_directory() -> Path:
    return _configured_directory(settings.media_private_upload_dir)


def media_access_reference(media_id: int) -> str:
    return f"/api/media/{media_id}/access-url"


def _legacy_reference(stored_filename: str) -> str:
    return f"/uploads/{stored_filename}"


def _safe_stored_filename(stored_filename: str) -> str:
    if (
        not stored_filename
        or stored_filename in {".", ".."}
        or len(stored_filename) > 255
        or "/" in stored_filename
        or "\\" in stored_filename
        or "\x00" in stored_filename
    ):
        raise RuntimeError("Unsafe stored media filename found in the database.")
    return stored_filename


def media_storage_path(media: MediaAsset) -> Path:
    stored_filename = _safe_stored_filename(media.stored_filename)
    directory = private_upload_directory() if media.is_private else public_upload_directory()
    return directory / stored_filename


def migrate_private_asset(media: MediaAsset) -> Path:
    stored_filename = _safe_stored_filename(media.stored_filename)
    private_directory = private_upload_directory()
    public_directory = public_upload_directory()
    private_directory.mkdir(parents=True, exist_ok=True)
    target = private_directory / stored_filename
    legacy_source = public_directory / stored_filename
    if not target.exists() and legacy_source.exists():
        os.replace(legacy_source, target)
    return target


def migrate_private_files(db: Session) -> None:
    private_media = db.scalars(select(MediaAsset).where(MediaAsset.is_private.is_(True))).all()
    for media in private_media:
        migrate_private_asset(media)


def normalize_content_type(content_type: str | None) -> str:
    normalized = (content_type or "").split(";", 1)[0].strip().lower()
    return MIME_ALIASES.get(normalized, normalized)


def media_download_filename(media: MediaAsset) -> str:
    filename = media.original_filename
    if Path(filename).suffix:
        return filename
    extensions = MIME_EXTENSION_PAIRS.get(normalize_content_type(media.content_type))
    if not extensions:
        return filename
    extension = min(extensions, key=lambda value: (len(value), value))
    return f"{filename}{extension}"


def resolve_media_download(media: MediaAsset, path: Path) -> MediaDownload:
    content_type = normalize_content_type(media.content_type)
    filename = media_download_filename(media)
    if content_type == "application/msword" and _matches_declared_content(path, "application/x-hwp"):
        filename = f"{Path(filename).stem}.hwp"
        content_type = "application/x-hwp"
    return MediaDownload(filename=filename, content_type=content_type)


# 비ASCII 바이트를 담은 퍼센트 이스케이프. %20 같은 ASCII 범위는 걸리지 않는다.
_PERCENT_ENCODED_NON_ASCII = re.compile(r"%[89A-Fa-f][0-9A-Fa-f]")


def _decode_percent_encoded_filename(filename: str) -> str:
    """React Native FormData가 감싸 보낸 파일명을 되돌린다.

    RN 0.77+ 의 Libraries/Network/FormData.js 는 filename 을 encodeURIComponent 로
    감싼다. RFC 5987 의 filename* 가 아니라 평범한 filename= 값이라, 서버는
    "%EB%B3%B4%EA%B3%A0%EC%84%9C.pdf" 를 글자 그대로 읽는다. 브라우저 FormData 는
    이렇게 하지 않아 앱에서만 깨져 보인다.

    파일명에 들어 있는 진짜 '%' 를 건드리지 않도록, 비ASCII 바이트가 있고 전체가
    UTF-8 로 풀릴 때만 되돌린다.
    """

    if not _PERCENT_ENCODED_NON_ASCII.search(filename):
        return filename
    try:
        return unquote(filename, errors="strict") or filename
    except UnicodeDecodeError:
        return filename


def normalize_original_filename(filename: str | None) -> str:
    # 경로 분리와 길이 검사는 되돌린 뒤의 실제 이름을 기준으로 한다.
    decoded = _decode_percent_encoded_filename(filename or "")
    basename = decoded.replace("\\", "/").rsplit("/", 1)[-1].strip()
    if (
        not basename
        or basename in {".", ".."}
        or len(basename) > 255
        or "\x00" in basename
        or any(ord(character) < 32 for character in basename)
    ):
        raise AppException(status_code=422, message="A valid filename is required.", code="VALIDATION_ERROR")
    return basename


def validate_upload_declaration(filename: str | None, content_type: str | None) -> UploadDeclaration:
    original_filename = normalize_original_filename(filename)
    normalized_content_type = normalize_content_type(content_type)
    extension = Path(original_filename).suffix.lower()
    allowed_mime_types = _csv_values(settings.media_allowed_mime_types)
    allowed_extensions = _csv_values(settings.media_allowed_extensions)

    if normalized_content_type not in allowed_mime_types or normalized_content_type not in MIME_EXTENSION_PAIRS:
        raise AppException(
            status_code=415,
            message="This file type is not allowed.",
            code="UNSUPPORTED_MEDIA_TYPE",
        )
    if extension not in allowed_extensions:
        raise AppException(
            status_code=415,
            message="This file extension is not allowed.",
            code="UNSUPPORTED_MEDIA_TYPE",
        )
    if extension not in MIME_EXTENSION_PAIRS[normalized_content_type]:
        raise AppException(
            status_code=415,
            message="The filename extension does not match the declared media type.",
            code="MEDIA_TYPE_MISMATCH",
        )
    return UploadDeclaration(
        original_filename=original_filename,
        content_type=normalized_content_type,
        extension=extension,
    )


def _matches_declared_content(path: Path, content_type: str) -> bool:
    with path.open("rb") as handle:
        header = handle.read(64)

    if content_type == "image/jpeg":
        return header.startswith(b"\xff\xd8\xff")
    if content_type == "image/png":
        return header.startswith(b"\x89PNG\r\n\x1a\n")
    if content_type == "image/gif":
        return header.startswith((b"GIF87a", b"GIF89a"))
    if content_type == "image/webp":
        return len(header) >= 12 and header.startswith(b"RIFF") and header[8:12] == b"WEBP"
    if content_type in {"image/heic", "image/heif"}:
        brands = {b"heic", b"heix", b"hevc", b"hevx"} if content_type == "image/heic" else {b"mif1", b"msf1", b"heif"}
        return len(header) >= 12 and header[4:8] == b"ftyp" and header[8:12] in brands
    if content_type == "application/pdf":
        return header.startswith(b"%PDF-")
    if content_type in OLE_MIME_TYPES:
        if not header.startswith(OLE_SIGNATURE):
            return False
        is_hwp = HWP_DOCUMENT_SIGNATURE in path.read_bytes()
        if content_type in {"application/x-hwp", "application/haansofthwp", "application/vnd.hancom.hwp"}:
            return is_hwp
        return not is_hwp
    marker = OPENXML_MARKERS.get(content_type)
    if marker is not None:
        try:
            with zipfile.ZipFile(path) as archive:
                names = archive.namelist()
        except (OSError, zipfile.BadZipFile):
            return False
        return "[Content_Types].xml" in names and any(name.startswith(marker) for name in names)
    if content_type == "application/zip":
        return zipfile.is_zipfile(path)
    if content_type == "text/plain":
        return b"\x00" not in path.read_bytes()
    if content_type in {"application/x-ipynb+json", "application/json"}:
        try:
            notebook = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return False
        return (
            isinstance(notebook, dict)
            and isinstance(notebook.get("cells"), list)
            and isinstance(notebook.get("metadata"), dict)
            and isinstance(notebook.get("nbformat"), int)
        )
    return False


async def store_upload(upload: UploadFile, *, private: bool) -> StoredUpload:
    declaration = validate_upload_declaration(upload.filename, upload.content_type)
    target_directory = private_upload_directory() if private else public_upload_directory()
    target_directory.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{generate_token_urlsafe()}{declaration.extension}"
    final_path = target_directory / stored_filename
    temporary_path = target_directory / f".{stored_filename}.{generate_token_urlsafe()}.uploading"
    total = 0

    try:
        await upload.seek(0)
        with temporary_path.open("xb") as destination:
            while True:
                chunk = await upload.read(settings.media_upload_chunk_bytes)
                if not chunk:
                    break
                if total + len(chunk) > settings.media_upload_max_bytes:
                    raise AppException(
                        status_code=413,
                        message="The uploaded file is too large.",
                        code="FILE_TOO_LARGE",
                    )
                destination.write(chunk)
                total += len(chunk)

        if total == 0:
            raise AppException(status_code=400, message="Empty files are not allowed.", code="EMPTY_FILE")
        if not _matches_declared_content(temporary_path, declaration.content_type):
            raise AppException(
                status_code=415,
                message="The file content does not match the declared media type.",
                code="MEDIA_TYPE_MISMATCH",
            )
        os.replace(temporary_path, final_path)
    except BaseException:
        temporary_path.unlink(missing_ok=True)
        final_path.unlink(missing_ok=True)
        raise

    return StoredUpload(
        original_filename=declaration.original_filename,
        stored_filename=stored_filename,
        content_type=declaration.content_type,
        file_size=total,
        path=final_path,
    )


def delete_stored_upload(stored: StoredUpload) -> None:
    stored.path.unlink(missing_ok=True)


def _media_reference_candidates(media: MediaAsset) -> frozenset[str]:
    candidates = {
        media_access_reference(media.id),
        _legacy_reference(media.stored_filename),
    }
    if media.url:
        candidates.add(media.url)
    return frozenset(candidates)


def _is_owner_profile_asset(db: Session, media: MediaAsset) -> bool:
    candidates = _media_reference_candidates(media)
    return (
        db.scalar(
            select(User.id)
            .where(
                User.id == media.owner_id,
                User.profile_image_url.in_(candidates),
            )
            .limit(1)
        )
        is not None
    )


def _banner_references(banner: Banner) -> set[str]:
    references = {banner.image_url} if banner.image_url else set()
    if isinstance(banner.image_urls, dict):
        references.update(value for value in banner.image_urls.values() if isinstance(value, str))
    return references


def _is_visible_banner_asset(db: Session, media: MediaAsset, user: User) -> bool:
    candidates = _media_reference_candidates(media)
    banners = db.scalars(select(Banner).where((Banner.image_url.is_not(None)) | (Banner.image_urls.is_not(None)))).all()
    now = utc_now()
    for banner in banners:
        if not candidates.intersection(_banner_references(banner)):
            continue
        if user.role == "admin":
            return True
        if (
            banner.is_active
            and (banner.starts_at is None or banner.starts_at <= now)
            and (banner.ends_at is None or banner.ends_at >= now)
        ):
            return True
    return False


def _nested_string_values(value: object) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for nested_value in value.values():
            yield from _nested_string_values(nested_value)
    elif isinstance(value, (list, tuple)):
        for nested_value in value:
            yield from _nested_string_values(nested_value)


def _is_readable_board_metadata_asset(db: Session, media: MediaAsset, user: User) -> bool:
    candidates = _media_reference_candidates(media)
    boards = db.scalars(select(Board).where(Board.metadata_json.is_not(None))).all()
    for board in boards:
        if not board.is_active or not can_read_board(user, board.read_permission):
            continue
        if candidates.intersection(_nested_string_values(board.metadata_json)):
            return True
    return False


def _is_readable_faq_asset(db: Session, media: MediaAsset) -> bool:
    return (
        db.scalar(
            select(FAQAttachment.id)
            .join(FAQ, FAQ.id == FAQAttachment.faq_id)
            .where(
                FAQAttachment.media_id == media.id,
                FAQ.is_active.is_(True),
            )
            .limit(1)
        )
        is not None
    )


def _readable_linked_post_exists(db: Session, media: MediaAsset, user: User) -> tuple[bool, bool]:
    posts = db.scalars(
        select(Post)
        .join(PostAttachment, PostAttachment.post_id == Post.id)
        .where(
            PostAttachment.media_id == media.id,
            Post.deleted_at.is_(None),
        )
        .order_by(Post.id.asc())
    ).all()
    for post in posts:
        try:
            require_post_read(db, post, user)
        except AppException:
            continue
        return True, True
    return bool(posts), False


def _mutual_aid_evidence_access(db: Session, media: MediaAsset, user: User) -> tuple[bool, bool]:
    rows = db.execute(
        select(Post, PostMutualAid.status)
        .join(PostAttachment, PostAttachment.post_id == Post.id)
        .join(Board, Board.id == Post.board_id)
        .outerjoin(PostMutualAid, PostMutualAid.post_id == Post.id)
        .where(
            PostAttachment.media_id == media.id,
            Board.board_type == "mutual_aid",
        )
    ).all()
    for post, status in rows:
        if post.author_id != user.id or post.deleted_at is not None or status != "processing":
            continue
        try:
            require_post_read(db, post, user)
        except AppException:
            continue
        return True, True
    return bool(rows), False


def require_media_access(db: Session, media: MediaAsset | None, user: User) -> MediaAsset:
    if media is None or media.status != "ready":
        raise AppException(status_code=404, message="Media not found.", code="NOT_FOUND")
    if user.role == "admin":
        return media
    # Evidence policy takes precedence even for legacy non-private assets or
    # assets also referenced by an ordinary post/profile.
    is_evidence, can_edit_evidence = _mutual_aid_evidence_access(db, media, user)
    if is_evidence:
        if can_edit_evidence:
            return media
        raise AppException(status_code=404, message="Media not found.", code="NOT_FOUND")
    if media.is_private:
        if media.owner_id == user.id:
            return media
        raise AppException(status_code=404, message="Media not found.", code="NOT_FOUND")

    has_post_links, can_read_linked_post = _readable_linked_post_exists(db, media, user)
    if can_read_linked_post:
        return media
    if (
        _is_owner_profile_asset(db, media)
        or _is_visible_banner_asset(db, media, user)
        or _is_readable_board_metadata_asset(db, media, user)
        or _is_readable_faq_asset(db, media)
    ):
        return media
    if not has_post_links and media.owner_id == user.id:
        return media
    raise AppException(status_code=404, message="Media not found.", code="NOT_FOUND")


def resolve_media_reference(db: Session, reference: str) -> MediaAsset | None:
    parsed = urlsplit(reference)
    if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment:
        raise AppException(
            status_code=422,
            message="Only server-relative media references are allowed.",
            code="VALIDATION_ERROR",
        )
    stable_match = STABLE_REFERENCE_RE.fullmatch(parsed.path)
    if stable_match is not None:
        return db.get(MediaAsset, int(stable_match.group("media_id")))

    legacy_match = LEGACY_UPLOAD_RE.fullmatch(parsed.path)
    if legacy_match is None:
        raise AppException(
            status_code=422,
            message="Unsupported media reference.",
            code="VALIDATION_ERROR",
        )
    try:
        stored_filename = _safe_stored_filename(legacy_match.group("stored_filename"))
    except RuntimeError as exc:
        raise AppException(
            status_code=422,
            message="Unsupported media reference.",
            code="VALIDATION_ERROR",
        ) from exc
    matches = db.scalars(
        select(MediaAsset)
        .where(MediaAsset.stored_filename == stored_filename)
        .order_by(MediaAsset.id.asc())
        .limit(2)
    ).all()
    return matches[0] if len(matches) == 1 else None


def validate_profile_image_reference(db: Session, reference: str, user: User) -> MediaAsset:
    media = resolve_media_reference(db, reference)
    if (
        media is None
        or media.owner_id != user.id
        or media.status != "ready"
        or media.is_private
        or not normalize_content_type(media.content_type).startswith("image/")
    ):
        raise AppException(
            status_code=422,
            message="Profile image must be an owned, ready, public image.",
            code="VALIDATION_ERROR",
        )
    return media


def profile_image_media_id(db: Session, user: User) -> int | None:
    reference = (user.profile_image_url or "").strip()
    if not reference:
        return None
    try:
        return validate_profile_image_reference(db, reference, user).id
    except AppException:
        return None


def _signature_payload(media: MediaAsset, expires: int) -> bytes:
    stored_filename = _safe_stored_filename(media.stored_filename)
    return f"media-file:v1:{media.id}:{stored_filename}:{expires}".encode("utf-8")


def media_file_signature(media: MediaAsset, expires: int) -> str:
    return hmac.new(
        settings.auth_secret_key.encode("utf-8"),
        _signature_payload(media, expires),
        hashlib.sha256,
    ).hexdigest()


def create_media_access_url(media: MediaAsset, *, now: int | None = None) -> tuple[str, int]:
    current_time = int(time.time()) if now is None else now
    expires = current_time + settings.media_access_url_expire_seconds
    query = urlencode({"expires": expires, "signature": media_file_signature(media, expires)})
    return f"/api/media/files/{media.id}?{query}", settings.media_access_url_expire_seconds


def validate_media_file_signature(
    media: MediaAsset,
    *,
    expires: int,
    signature: str,
    now: int | None = None,
) -> None:
    current_time = int(time.time()) if now is None else now
    expected = media_file_signature(media, expires)
    if expires < current_time or not hmac.compare_digest(signature, expected):
        raise AppException(
            status_code=403,
            message="Media access URL expired or is invalid.",
            code="FORBIDDEN",
        )
