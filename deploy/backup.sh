#!/bin/sh
# Database backup. Runs from a systemd timer every six hours and before every deploy.
# Every backup is checked, recorded for monitoring and, when off-site storage is configured, copied there encrypted.
set -eu
umask 077
cd /opt/findbox
mkdir -p backups
base="backups/findbox-$(date -u +%Y%m%dT%H%M%SZ).sql"
# A failed pg_dump must not be hidden by gzip succeeding.
docker compose exec -T db pg_dump -U findbox -d findbox --no-owner > "$base" < /dev/null
test -s "$base"
# A complete dump always ends with this line; a truncated one does not.
tail -n 5 "$base" | grep -q 'PostgreSQL database dump complete'
gzip "$base"
gzip -t "$base.gz"
printf 'Backup created: %s.gz\n' "$base"
beat() { docker compose exec -T db psql -U findbox -d findbox -q -c "INSERT INTO runtime_heartbeat(name,last_ok) VALUES('$1',now()) ON CONFLICT(name) DO UPDATE SET last_ok=now()" < /dev/null >/dev/null 2>&1 || true; }
beat local_backup

# Optional encrypted off-site copy to any S3-compatible bucket. Set these in /opt/findbox/.env:
#   BACKUP_S3_URL=https://<endpoint>/<bucket>   BACKUP_S3_REGION=<region>   BACKUP_S3_KEY=...   BACKUP_S3_SECRET=...
# The file is encrypted on this server first with /opt/findbox-backup.key. Keep a copy of that key somewhere
# safe that is NOT this server: without it the off-site copies cannot be read.
val() { sed -n "s/^$1=//p" .env 2>/dev/null | tail -n 1; }
s3_url=$(val BACKUP_S3_URL); s3_key=$(val BACKUP_S3_KEY); s3_secret=$(val BACKUP_S3_SECRET); s3_region=$(val BACKUP_S3_REGION)
if [ -n "$s3_url" ] && [ -n "$s3_key" ] && [ -n "$s3_secret" ] && [ -s /opt/findbox-backup.key ]; then
  enc=$(mktemp /tmp/findbox-backup-XXXXXX.enc)
  if openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass file:/opt/findbox-backup.key -in "$base.gz" -out "$enc" \
     && curl --fail --silent --show-error --max-time 300 --aws-sigv4 "aws:amz:${s3_region:-auto}:s3" --user "$s3_key:$s3_secret" -T "$enc" "$s3_url/$(basename "$base").gz.enc"; then
    beat offsite_backup
    printf 'Encrypted off-site copy stored.\n'
  else
    printf 'Off-site copy failed; the local backup is intact.\n' >&2
  fi
  rm -f "$enc"
fi

# Keep 30 days locally (manual-* backups are never removed); off-site copies have their own retention.
find backups -maxdepth 1 -type f -name 'findbox-*.sql.gz' -mtime +30 -delete
