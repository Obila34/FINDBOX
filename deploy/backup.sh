#!/bin/sh
set -eu
umask 077
mkdir -p backups
base="backups/findbox-$(date -u +%Y%m%dT%H%M%SZ).sql"
# A failed pg_dump must not be hidden by gzip succeeding.
docker compose exec -T db pg_dump -U findbox -d findbox --no-owner > "$base"
test -s "$base"
gzip "$base"
printf 'Backup created: %s.gz\n' "$base"
# Copy this file to encrypted off-site storage; verify restores regularly.

# Keep 30 days locally; off-site copies have independent retention.
find backups -maxdepth 1 -type f -name 'findbox-*.sql.gz' -mtime +30 -delete
