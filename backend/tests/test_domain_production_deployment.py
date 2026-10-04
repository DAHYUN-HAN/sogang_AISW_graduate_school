from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]


def configure_module():
    path = ROOT / "scripts/configure_public_domain.py"
    assert path.is_file(), "Missing persistent domain configuration helper"
    spec = importlib.util.spec_from_file_location("configure_public_domain", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_configuration_preserves_secrets_and_is_idempotent(tmp_path):
    env = tmp_path / ".env.production"
    original = "# operator settings\nPUBLIC_IP=34.50.35.119\nPOSTGRES_PASSWORD=private-value\nAUTH_SECRET_KEY=another-private-value\nPUBLIC_API_URL=https://34.50.35.119/api\n"
    env.write_text(original, encoding="utf-8")
    module = configure_module()
    module.configure(env, ROOT / "deploy/public-domain.env")
    result = env.read_text(encoding="utf-8")
    assert "POSTGRES_PASSWORD=private-value" in result
    assert "AUTH_SECRET_KEY=another-private-value" in result
    assert "PUBLIC_IP=34.50.35.119" in result
    assert "PUBLIC_API_URL=https://www.aisw-campus.com/api" in result
    assert "ALLOWED_HOSTS=34.50.35.119,www.aisw-campus.com,aisw-campus.com" in result
    assert "TLS_CERT_NAME=aisw-campus.com" in result
    assert env.with_name(env.name + ".before-domain").read_text(encoding="utf-8") == original
    module.configure(env, ROOT / "deploy/public-domain.env")
    assert env.read_text(encoding="utf-8") == result
    assert env.with_name(env.name + ".before-domain").read_text(encoding="utf-8") == original


@pytest.mark.parametrize("host", ["localhost", "https://example.com", "www.aisw-campus.com; touch /tmp/x", "*.aisw-campus.com", "../cert"])
def test_invalid_profile_does_not_modify_operator_environment(tmp_path, host):
    env = tmp_path / ".env.production"
    original = "PUBLIC_IP=34.50.35.119\nPOSTGRES_PASSWORD=keep-me\n"
    env.write_text(original, encoding="utf-8")
    profile = tmp_path / "domain.env"
    profile.write_text(f"PUBLIC_HOST={host}\nPUBLIC_HOST_ALIASES=aisw-campus.com\nTLS_CERT_NAME=aisw-campus.com\n", encoding="utf-8")
    with pytest.raises(ValueError):
        configure_module().configure(env, profile)
    assert env.read_text(encoding="utf-8") == original
    assert not env.with_name(env.name + ".before-domain").exists()


def test_cors_matches_only_configured_https_origins(tmp_path):
    import re

    env = tmp_path / ".env.production"
    env.write_text("PUBLIC_IP=34.50.35.119\n", encoding="utf-8")
    module = configure_module()
    module.configure(env, ROOT / "deploy/public-domain.env")
    values = module.read_env(env)
    cors = re.compile(values["CORS_ORIGIN_REGEX"])
    for origin in ["https://www.aisw-campus.com", "https://aisw-campus.com", "https://34.50.35.119"]:
        assert cors.fullmatch(origin)
    for origin in ["http://www.aisw-campus.com", "https://evilaisw-campus.com", "https://www.aisw-campus.com.attacker.com"]:
        assert not cors.fullmatch(origin)


def test_check_rejects_stale_public_settings_without_writing(tmp_path):
    env = tmp_path / ".env.production"
    env.write_text("PUBLIC_IP=34.50.35.119\n", encoding="utf-8")
    module = configure_module()
    module.configure(env, ROOT / "deploy/public-domain.env")
    module.configure(env, ROOT / "deploy/public-domain.env", check=True)
    stale = env.read_text(encoding="utf-8").replace("PUBLIC_API_URL=https://www.aisw-campus.com/api", "PUBLIC_API_URL=https://34.50.35.119/api")
    env.write_text(stale, encoding="utf-8")
    with pytest.raises(ValueError, match="Configure first"):
        module.configure(env, ROOT / "deploy/public-domain.env", check=True)
    assert env.read_text(encoding="utf-8") == stale
