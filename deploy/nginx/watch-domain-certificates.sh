#!/bin/sh
set -eu
interval="${CERTIFICATE_WATCH_INTERVAL_SECONDS:-300}"
previous=""
while :; do
    # Certbot replaces live symlinks during renewal; a transient missing file
    # must not kill this background process while Nginx stays healthy.
    if ! current="$(sha256sum "/etc/letsencrypt/live/${PUBLIC_IP}/fullchain.pem" "/etc/letsencrypt/live/${TLS_CERT_NAME}/fullchain.pem")"; then
        printf 'Certificate watch: read failed; retrying next interval.\n' >&2
        sleep "$interval"
        continue
    fi
    if [ -n "$previous" ] && [ "$current" != "$previous" ]; then
        if ! nginx -t || ! nginx -s reload; then
            printf 'Certificate watch: reload failed; retrying next interval.\n' >&2
            sleep "$interval"
            continue
        fi
    fi
    previous="$current"
    sleep "$interval"
done
