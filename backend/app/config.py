from ipaddress import IPv4Address, IPv4Network, IPv6Network, ip_address, ip_network
from pathlib import Path
import re
from typing import Literal
from urllib.parse import urlparse

from email_validator import EmailNotValidError, validate_email
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parents[1]
RUNTIME_ENVIRONMENTS = frozenset({"development", "test", "staging", "production"})
DEPLOYED_ENVIRONMENTS = frozenset({"staging", "production"})
_PUBLIC_HOSTNAME_RE = re.compile(
    r"(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+"
    r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
)
ProxyNetwork = IPv4Network | IPv6Network
RFC1918_NETWORKS = (
    IPv4Network("10.0.0.0/8"),
    IPv4Network("172.16.0.0/12"),
    IPv4Network("192.168.0.0/16"),
)
REQUIRED_DEPLOYMENT_MEDIA_EXTENSIONS = frozenset(
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp", ".heic", ".heif",
        ".pdf", ".doc", ".xls", ".ppt", ".docx", ".xlsx", ".pptx",
        ".hwp", ".zip", ".txt", ".ipynb",
    }
)
REQUIRED_DEPLOYMENT_MEDIA_MIME_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/heic",
        "image/heif",
        "application/pdf",
        "application/msword",
        "application/vnd.ms-excel",
        "application/vnd.ms-powerpoint",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/x-hwp",
        "application/zip",
        "text/plain",
        "application/x-ipynb+json",
    }
)


class Settings(BaseSettings):
    app_environment: str = "development"
    seed_demo_data: bool | None = None
    database_url: str = "postgresql+psycopg://postgres:postgres@db:5432/sogang_app"
    app_name: str = "AI·SW CAMPUS API"
    app_version: str = "0.1.0"
    usage_tracking_enabled: bool = True
    auth_secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    email_verification_expire_minutes: int = 5
    email_verification_resend_cooldown_seconds: int = 5 * 60
    password_reset_expire_minutes: int = 5
    password_reset_resend_cooldown_seconds: int = 5 * 60
    account_deletion_receipt_retention_days: int | None = Field(default=None, ge=1, le=3650)
    # Deprecated compatibility flag. Authentication codes are never returned by the API.
    dev_auth_codes: bool = False
    smtp_host: str | None = None
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = ""
    smtp_from_name: str = "AI·SW CAMPUS"
    smtp_reply_to: str | None = None
    smtp_auth: Literal["password", "none"] = "password"
    smtp_security: Literal["starttls", "ssl", "plain"] | None = None
    smtp_timeout_seconds: int = Field(default=10, ge=1, le=30)
    # Public because it is embedded in frontend builds; mirrored here so a
    # production server cannot be deployed with a shorter client deadline.
    expo_public_auth_email_timeout_ms: int = Field(default=120_000, ge=15_000, le=120_000)
    # Deprecated compatibility flag. SMTP_SECURITY takes precedence when set.
    smtp_use_tls: bool = True
    smtp_required: bool = False
    expo_push_enabled: bool = True
    # ponytail: NOTIFY_SELF=true lets you comment/like your own post and get the notification,
    # so notification wording can be verified with a single account. Keep false in production.
    notify_self: bool = False
    rate_limit_enabled: bool = True
    rate_limit_trust_proxy: bool = False
    rate_limit_trusted_proxy_ips: str = ""
    cloudflare_enabled: bool = False
    cloudflare_tunnel_subnet: IPv4Network = IPv4Network("172.30.250.0/28")
    cloudflare_tunnel_ip: IPv4Address = IPv4Address("172.30.250.14")
    media_upload_max_bytes: int = Field(default=10 * 1024 * 1024, ge=1, le=10 * 1024 * 1024)
    media_upload_chunk_bytes: int = Field(default=1024 * 1024, ge=4096, le=4 * 1024 * 1024)
    media_access_url_expire_seconds: int = Field(default=5 * 60, ge=30, le=15 * 60)
    media_upload_dir: Path = Path("uploads")
    media_private_upload_dir: Path = Path("private_uploads")
    media_allowed_mime_types: str = (
        "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,"
        "application/pdf,application/msword,application/vnd.ms-excel,application/vnd.ms-powerpoint,"
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document,"
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,"
        "application/vnd.openxmlformats-officedocument.presentationml.presentation,"
        "application/x-hwp,application/haansofthwp,application/vnd.hancom.hwp,"
        "application/zip,text/plain,application/x-ipynb+json,application/json"
    )
    media_allowed_extensions: str = (
        ".jpg,.jpeg,.png,.gif,.webp,.heic,.heif,.pdf,.doc,.xls,.ppt,.docx,.xlsx,.pptx,.hwp,.zip,.txt,.ipynb"
    )
    support_email: str | None = None
    public_api_url: str | None = None
    support_url: str | None = None
    privacy_policy_url: str | None = None
    account_deletion_url: str | None = None
    operations_alert_webhook_url: str | None = None
    operations_alert_timeout_seconds: int = Field(default=3, ge=1, le=10)
    allowed_hosts: str = "*"
    cors_origin_regex: str = r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"

    @property
    def normalized_environment(self) -> str:
        return self.app_environment.strip().lower()

    @property
    def is_deployed_environment(self) -> bool:
        return self.normalized_environment in DEPLOYED_ENVIRONMENTS

    @property
    def uses_demo_seed(self) -> bool:
        """Use deterministic fixtures only when explicitly enabled or local by default.

        Imported QA databases opt out so an application restart cannot replace
        operator-managed board metadata or create a demo administrator.
        """
        if self.seed_demo_data is not None:
            return self.seed_demo_data
        return not self.is_deployed_environment

    @staticmethod
    def _is_placeholder(value: str | None) -> bool:
        normalized = (value or "").strip().lower()
        return any(marker in normalized for marker in ("replace-with", "change-me", "placeholder", "example.invalid"))

    @staticmethod
    def _csv_values(value: str) -> tuple[str, ...]:
        return tuple(
            dict.fromkeys(
                item.strip().lower()
                for item in value.split(",")
                if item.strip()
            )
        )

    def trusted_hosts(self) -> tuple[str, ...]:
        hosts = self._csv_values(self.allowed_hosts)
        if not self.is_deployed_environment:
            return hosts or ("*",)
        return self._validated_public_hosts(hosts)

    @property
    def resolved_smtp_security(self) -> Literal["starttls", "ssl", "plain"]:
        if self.smtp_security is not None:
            return self.smtp_security
        return "starttls" if self.smtp_use_tls else "plain"

    def _validated_public_hosts(self, hosts: tuple[str, ...] | None = None) -> tuple[str, ...]:
        normalized_hosts = self._csv_values(self.allowed_hosts) if hosts is None else hosts
        if not normalized_hosts:
            raise RuntimeError("Deployment ALLOWED_HOSTS must contain at least one public API hostname.")

        for hostname in normalized_hosts:
            if (
                "*" in hostname
                or self._is_placeholder(hostname)
                or "://" in hostname
                or "/" in hostname
                or "@" in hostname
                or ":" in hostname
                or hostname == "localhost"
                or hostname.endswith((".local", ".localhost", ".invalid", ".example", ".test"))
                or hostname == "example.com"
                or hostname.endswith(".example.com")
            ):
                raise RuntimeError(
                    "Deployment ALLOWED_HOSTS must contain only explicit public hostnames or public IPv4 addresses."
                )

            try:
                address = ip_address(hostname)
            except ValueError:
                if _PUBLIC_HOSTNAME_RE.fullmatch(hostname) is None:
                    raise RuntimeError(
                        "Deployment ALLOWED_HOSTS must contain only explicit public hostnames or public IPv4 addresses."
                    )
            else:
                if address.version != 4 or not address.is_global:
                    raise RuntimeError(
                        "Deployment ALLOWED_HOSTS must not contain private, local, reserved, or wildcard addresses."
                    )
        return normalized_hosts

    def rate_limit_trusted_proxy_networks(self) -> tuple[ProxyNetwork, ...]:
        networks: list[ProxyNetwork] = []
        for value in self._csv_values(self.rate_limit_trusted_proxy_ips):
            if "*" in value or self._is_placeholder(value):
                raise RuntimeError(
                    "RATE_LIMIT_TRUSTED_PROXY_IPS must contain explicit ingress IP addresses or CIDR ranges."
                )
            try:
                network = ip_network(value, strict=False)
            except ValueError as exc:
                raise RuntimeError(
                    "RATE_LIMIT_TRUSTED_PROXY_IPS must contain explicit ingress IP addresses or CIDR ranges."
                ) from exc
            if (
                network.prefixlen == 0
                or network.network_address.is_unspecified
                or network.network_address.is_multicast
            ):
                raise RuntimeError(
                    "RATE_LIMIT_TRUSTED_PROXY_IPS must not trust an unspecified, multicast, or all-address range."
                )
            networks.append(network)
        return tuple(networks)

    @staticmethod
    def _require_deployment_email(name: str, value: str | None) -> None:
        normalized = (value or "").strip().lower()
        domain = normalized.rsplit("@", 1)[-1] if "@" in normalized else ""
        if (
            not normalized
            or "@" not in normalized
            or Settings._is_placeholder(normalized)
            or domain in {"localhost", "example.com"}
            or domain.endswith((".local", ".localhost", ".invalid", ".example", ".test"))
        ):
            raise RuntimeError(f"Deployment {name} must be a monitored provider-authorized email address.")
        try:
            validate_email(normalized, check_deliverability=False)
        except EmailNotValidError as exc:
            raise RuntimeError(
                f"Deployment {name} must be a valid monitored provider-authorized email address."
            ) from exc

    @staticmethod
    def _require_safe_header_text(name: str, value: str | None) -> None:
        normalized = (value or "").strip()
        if not normalized or "\r" in normalized or "\n" in normalized:
            raise RuntimeError(f"Deployment {name} must be a non-empty single-line value.")

    @staticmethod
    def _require_deployment_public_https_url(name: str, value: str | None) -> None:
        if not value:
            raise RuntimeError(f"Deployment {name} must be configured.")
        parsed = urlparse(value)
        hostname = (parsed.hostname or "").lower()
        if (
            parsed.scheme != "https"
            or not hostname
            or parsed.username
            or parsed.password
            or Settings._is_placeholder(value)
            or hostname in {"localhost", "127.0.0.1", "::1", "0.0.0.0", "example.com"}
            or hostname.endswith((".local", ".localhost", ".invalid", ".example", ".test"))
            or hostname == "trycloudflare.com"
            or hostname.endswith(".trycloudflare.com")
        ):
            raise RuntimeError(f"Deployment {name} must be a public HTTPS URL without embedded credentials.")
        try:
            if ip_address(hostname).is_private or ip_address(hostname).is_loopback or ip_address(hostname).is_link_local:
                raise RuntimeError(f"Deployment {name} must not use a private or local IP address.")
        except ValueError:
            pass

    def validate_runtime(self) -> None:
        environment = self.normalized_environment
        if environment not in RUNTIME_ENVIRONMENTS:
            raise RuntimeError(
                "APP_ENVIRONMENT must be one of development, test, staging, or production."
            )
        if not self.is_deployed_environment:
            return
        if self.seed_demo_data:
            raise RuntimeError("Deployment SEED_DEMO_DATA must not be enabled.")
        allowed_hosts = self._validated_public_hosts()
        if self._is_placeholder(self.auth_secret_key) or len(self.auth_secret_key) < 32:
            raise RuntimeError("Deployment AUTH_SECRET_KEY must be a non-default value with at least 32 characters.")
        database = urlparse(self.database_url)
        if database.scheme not in {"postgresql", "postgresql+psycopg"}:
            raise RuntimeError("Deployment DATABASE_URL must use PostgreSQL.")
        if (
            not database.hostname
            or not database.username
            or not database.password
            or self._is_placeholder(database.username)
            or self._is_placeholder(database.password)
            or (database.username == "postgres" and database.password == "postgres")
        ):
            raise RuntimeError("Deployment DATABASE_URL must use explicit non-default, non-placeholder credentials.")
        if not self.smtp_required or not self.smtp_host or not self.smtp_from_email:
            raise RuntimeError("Deployment SMTP must be configured and SMTP_REQUIRED must be true.")
        smtp_username = (self.smtp_username or "").strip()
        smtp_password = self.smtp_password or ""
        if self.smtp_auth == "password" and (not smtp_username or not smtp_password.strip()):
            raise RuntimeError(
                "Deployment SMTP_AUTH=password requires non-empty SMTP_USERNAME and SMTP_PASSWORD."
            )
        if self.smtp_auth == "none" and (smtp_username or smtp_password):
            raise RuntimeError(
                "Deployment SMTP_AUTH=none requires SMTP_USERNAME and SMTP_PASSWORD to be empty."
            )
        smtp_host = self.smtp_host.strip().lower()
        if (
            self._is_placeholder(smtp_host)
            or smtp_host in {"localhost", "127.0.0.1", "::1"}
            or smtp_host.endswith((".local", ".localhost", ".invalid", ".example", ".test"))
        ):
            raise RuntimeError("Deployment SMTP_HOST must be a real provider endpoint.")
        if self.smtp_auth == "password" and (
            self._is_placeholder(smtp_username) or self._is_placeholder(smtp_password)
        ):
            raise RuntimeError("Deployment SMTP credentials must not contain placeholder values.")
        if self.resolved_smtp_security == "plain":
            raise RuntimeError("Deployment SMTP_SECURITY must be starttls or ssl; plaintext SMTP is forbidden.")
        if self.expo_public_auth_email_timeout_ms <= self.smtp_timeout_seconds * 1000:
            raise RuntimeError(
                "Deployment EXPO_PUBLIC_AUTH_EMAIL_TIMEOUT_MS must be longer than SMTP_TIMEOUT_SECONDS."
            )
        self._require_deployment_email("SMTP_FROM_EMAIL", self.smtp_from_email)
        self._require_safe_header_text("SMTP_FROM_NAME", self.smtp_from_name)
        if self.smtp_reply_to:
            self._require_deployment_email("SMTP_REPLY_TO", self.smtp_reply_to)
        cors = self.cors_origin_regex.strip()
        try:
            re.compile(cors)
        except re.error as exc:
            raise RuntimeError("Deployment CORS_ORIGIN_REGEX must be a valid regular expression.") from exc
        if (
            not cors.startswith("^https://")
            or not cors.endswith("$")
            or "https?" in cors
            or ".*" in cors
            or self._is_placeholder(cors)
            or any(value in cors.lower() for value in (".example", ".invalid", ".test"))
            or any(value in cors.lower() for value in ("localhost", "127\\.0\\.0\\.1", "192\\.168", "10\\.", "172\\."))
        ):
            raise RuntimeError("Deployment CORS_ORIGIN_REGEX must match only explicit deployed HTTPS origins.")
        if not self.rate_limit_enabled:
            raise RuntimeError("Deployment RATE_LIMIT_ENABLED must be true.")
        trusted_proxy_networks = self.rate_limit_trusted_proxy_networks()
        if self.rate_limit_trust_proxy and not trusted_proxy_networks:
            raise RuntimeError(
                "Deployment RATE_LIMIT_TRUST_PROXY requires explicit RATE_LIMIT_TRUSTED_PROXY_IPS."
            )
        if not self.rate_limit_trust_proxy and trusted_proxy_networks:
            raise RuntimeError(
                "Deployment RATE_LIMIT_TRUSTED_PROXY_IPS must be empty when RATE_LIMIT_TRUST_PROXY is false."
            )
        if environment == "production" and not self.rate_limit_trust_proxy:
            raise RuntimeError(
                "Production RATE_LIMIT_TRUST_PROXY must be true with the exact verified ingress peer allowlist."
            )
        if self.cloudflare_enabled:
            if not any(self.cloudflare_tunnel_ip in network for network in RFC1918_NETWORKS):
                raise RuntimeError(
                    "Deployment CLOUDFLARE_TUNNEL_IP must be a private IPv4 address on the dedicated origin network."
                )
            if (
                not any(self.cloudflare_tunnel_subnet.subnet_of(network) for network in RFC1918_NETWORKS)
                or not 24 <= self.cloudflare_tunnel_subnet.prefixlen <= 29
            ):
                raise RuntimeError(
                    "Deployment CLOUDFLARE_TUNNEL_SUBNET must be an RFC1918 /24 through /29 network."
                )
            if self.cloudflare_tunnel_ip not in self.cloudflare_tunnel_subnet or self.cloudflare_tunnel_ip in {
                self.cloudflare_tunnel_subnet.network_address,
                self.cloudflare_tunnel_subnet.broadcast_address,
            }:
                raise RuntimeError(
                    "Deployment CLOUDFLARE_TUNNEL_IP must be a usable address inside CLOUDFLARE_TUNNEL_SUBNET."
                )
            expected_cloudflare_peer = ip_network(f"{self.cloudflare_tunnel_ip}/32")
            if trusted_proxy_networks != (expected_cloudflare_peer,):
                raise RuntimeError(
                    "Deployment RATE_LIMIT_TRUSTED_PROXY_IPS must contain only "
                    "CLOUDFLARE_TUNNEL_IP/32 when CLOUDFLARE_ENABLED is true."
                )
        if not self.expo_push_enabled:
            raise RuntimeError("Deployment EXPO_PUSH_ENABLED must be true for the launch notification contract.")
        if self.account_deletion_receipt_retention_days is None:
            raise RuntimeError(
                "Deployment ACCOUNT_DELETION_RECEIPT_RETENTION_DAYS must be explicitly approved and configured."
            )
        public_media = self.media_upload_dir.expanduser()
        private_media = self.media_private_upload_dir.expanduser()
        if not public_media.is_absolute() or not private_media.is_absolute() or public_media == private_media:
            raise RuntimeError(
                "Deployment MEDIA_UPLOAD_DIR and MEDIA_PRIVATE_UPLOAD_DIR must be distinct absolute durable paths."
            )
        configured_extensions = frozenset(self._csv_values(self.media_allowed_extensions))
        missing_extensions = sorted(REQUIRED_DEPLOYMENT_MEDIA_EXTENSIONS - configured_extensions)
        if missing_extensions:
            raise RuntimeError(
                "Deployment MEDIA_ALLOWED_EXTENSIONS is missing launch attachment types: "
                + ", ".join(missing_extensions)
            )
        configured_mime_types = frozenset(self._csv_values(self.media_allowed_mime_types))
        missing_mime_types = sorted(REQUIRED_DEPLOYMENT_MEDIA_MIME_TYPES - configured_mime_types)
        if missing_mime_types:
            raise RuntimeError(
                "Deployment MEDIA_ALLOWED_MIME_TYPES is missing launch attachment types: "
                + ", ".join(missing_mime_types)
            )
        self._require_deployment_email("SUPPORT_EMAIL", self.support_email)
        self._require_deployment_public_https_url("PUBLIC_API_URL", self.public_api_url)
        if not self.public_api_url.rstrip("/").endswith("/api"):
            raise RuntimeError("Deployment PUBLIC_API_URL must end with /api.")
        public_api_host = (urlparse(self.public_api_url).hostname or "").lower()
        if public_api_host not in allowed_hosts:
            raise RuntimeError("Deployment ALLOWED_HOSTS must include the PUBLIC_API_URL hostname.")
        self._require_deployment_public_https_url("SUPPORT_URL", self.support_url)
        self._require_deployment_public_https_url("PRIVACY_POLICY_URL", self.privacy_policy_url)
        self._require_deployment_public_https_url("ACCOUNT_DELETION_URL", self.account_deletion_url)
        self._require_deployment_public_https_url(
            "OPERATIONS_ALERT_WEBHOOK_URL",
            self.operations_alert_webhook_url,
        )

    model_config = SettingsConfigDict(env_file=BACKEND_ROOT / ".env", env_file_encoding="utf-8")


settings = Settings()
