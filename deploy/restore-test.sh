#!/bin/sh
# Proves the latest backup can actually be restored: loads it into a scratch database, compares it with
# the live one, then removes the scratch database. Runs daily from a systemd timer.
set -eu
umask 077
cd /opt/findbox
latest=$(ls -1t backups/findbox-*.sql.gz 2>/dev/null | head -n 1)
test -n "$latest"
gzip -t "$latest"
sql() { docker compose exec -T db psql -U findbox -d "$1" -At -v ON_ERROR_STOP=1 -c "$2" < /dev/null; }
scratch=findbox_restore_test
sql findbox "DROP DATABASE IF EXISTS $scratch" >/dev/null
sql findbox "CREATE DATABASE $scratch" >/dev/null
trap 'sql findbox "DROP DATABASE IF EXISTS '"$scratch"'" >/dev/null 2>&1 || true' EXIT
gunzip -c "$latest" | docker compose exec -T db psql -U findbox -d "$scratch" -q -v ON_ERROR_STOP=1 >/dev/null
tables=$(sql "$scratch" "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
live=$(sql findbox "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
users=$(sql "$scratch" "SELECT count(*) FROM users")
schools=$(sql "$scratch" "SELECT count(*) FROM schools")
# The live database may have gained a table since the backup, never lost one.
[ "$tables" -gt 20 ] && [ "$tables" -le "$live" ] && [ "$users" -gt 0 ]
sql findbox "INSERT INTO runtime_heartbeat(name,last_ok) VALUES('backup_restore_test',now()) ON CONFLICT(name) DO UPDATE SET last_ok=now()" >/dev/null
printf 'Restore test passed: %s restored with %s tables, %s accounts, %s schools.\n' "$latest" "$tables" "$users" "$schools"
