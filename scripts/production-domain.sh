#!/usr/bin/env bash
set -Eeuo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"
action="${1:-Config}"
env_file="${2:-.env.production}"
worker_env_file="${3:-.env.production.worker}"
if [[ "$env_file" != /* ]]; then env_file="$repo_root/$env_file"; fi
if [[ "$action" == Configure ]]; then
    python3 "$script_dir/configure_public_domain.py" "$env_file" "$repo_root/deploy/public-domain.env"
    exit
fi
export PUBLIC_DOMAIN_ENABLED=true
exec bash "$script_dir/production-ip.sh" "$action" "$env_file" "$worker_env_file"
