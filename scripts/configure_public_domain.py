"""Merge the committed public domain identity into an operator-owned env file."""
from __future__ import annotations

import argparse
import ipaddress
import os
from pathlib import Path
import re
import tempfile


def read_env(path: Path) -> dict[str, str]:
    values = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.removeprefix("export ").split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def public_hostname(value: str) -> str:
    if len(value) > 253 or value != value.lower() or "." not in value:
        raise ValueError("A lowercase public DNS hostname is required")
    if any(not re.fullmatch(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?", label) for label in value.split(".")):
        raise ValueError("Invalid public DNS hostname")
    if value.endswith((".local", ".localhost", ".internal", ".invalid", ".test", ".example")):
        raise ValueError("A deployed public DNS hostname is required")
    try:
        ipaddress.ip_address(value)
    except ValueError:
        return value
    raise ValueError("Use a domain name for PUBLIC_HOST")


def settings(env: Path, profile: Path) -> dict[str, str]:
    original = read_env(env)
    public = read_env(profile)
    if set(public) != {"PUBLIC_HOST", "PUBLIC_HOST_ALIASES", "TLS_CERT_NAME"}:
        raise ValueError("Public profile must contain only the three domain identity settings")
    host = public_hostname(public["PUBLIC_HOST"])
    aliases = [public_hostname(value) for value in public["PUBLIC_HOST_ALIASES"].split()]
    cert_name = public_hostname(public["TLS_CERT_NAME"])
    if host in aliases or len(aliases) != len(set(aliases)):
        raise ValueError("Domain aliases must be distinct from the canonical host")
    address = ipaddress.ip_address(original.get("PUBLIC_IP", ""))
    if address.version != 4 or not address.is_global:
        raise ValueError("PUBLIC_IP must remain a global IPv4 address")
    hosts = [str(address), host, *aliases]
    origin = "https://" + host
    return {
        **public,
        "ALLOWED_HOSTS": ",".join(hosts),
        "CORS_ORIGIN_REGEX": "^https://(?:" + "|".join(re.escape(value) for value in hosts) + ")$",
        "PUBLIC_API_URL": origin + "/api",
        "SUPPORT_URL": origin + "/legal/support",
        "PRIVACY_POLICY_URL": origin + "/legal/privacy",
        "ACCOUNT_DELETION_URL": origin + "/legal/account-deletion",
    }


def configure(env: Path, profile: Path, *, check: bool = False) -> None:
    desired = settings(env, profile)
    if check:
        current = read_env(env)
        if any(current.get(key) != value for key, value in desired.items()):
            raise ValueError("Domain configuration differs from deploy/public-domain.env; run Configure first")
        return
    original = env.read_text(encoding="utf-8-sig")
    remaining = dict(desired)
    lines = []
    for line in original.splitlines():
        key = line.strip().removeprefix("export ").split("=", 1)[0].strip()
        if key in desired:
            if key in remaining:
                lines.append(key + "=" + remaining.pop(key))
        else:
            lines.append(line)
    lines.extend(key + "=" + value for key, value in remaining.items())
    content = "\n".join(lines) + "\n"
    if content == original:
        return
    backup = env.with_name(env.name + ".before-domain")
    if not backup.exists():
        descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(original)
    descriptor, temporary = tempfile.mkstemp(prefix=".domain-env-", dir=env.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            stream.write(content)
        os.chmod(temporary, 0o600)
        os.replace(temporary, env)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("env", type=Path)
    parser.add_argument("profile", type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        configure(args.env, args.profile, check=args.check)
    except (ValueError, OSError) as error:
        parser.exit(1, f"Domain configuration failed: {error}\n")
    print("Domain configuration verified." if args.check else "Domain settings saved; credentials preserved.")
