#!/bin/sh
set -eu
umask 077
if [ -e /opt/findbox-deploy-paused ]; then
  echo "Production deployment is paused by the owner. Leave the current site running." >&2
  exit 78
fi
exec 9>/opt/findbox-deploy.lock
flock -w 600 9
archive=$(mktemp /opt/findbox-release-XXXXXX.tgz)
trap 'rm -f "$archive"' EXIT
cat > "$archive"
# Only trusted CI archives; reject absolute paths and parent traversal.
if tar -tzf "$archive" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then exit 1; fi
cd /opt/findbox
stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup=/opt/findbox-release-backups/$stamp-ci
mkdir -p "$backup"
cp -a src public server deploy package.json package-lock.json index.html vite.config.ts Dockerfile compose.yml .dockerignore "$backup/"
for image in web api migrate; do docker image tag "findbox-$image" "findbox-$image:rollback" 2>/dev/null || true; done
/bin/sh deploy/backup.sh
rollback() {
  echo 'Deployment failed; restoring previous application images.' >&2
  for image in web api migrate; do docker image tag "findbox-$image:rollback" "findbox-$image" 2>/dev/null || true; done
  cp -a "$backup/." /opt/findbox/
  docker compose up -d --no-deps --no-build api api2 web || true
}
# Replace one API instance and wait until it answers. The other instance serves the site meanwhile.
roll() {
  docker compose up -d --no-deps --no-build "$1" || return 1
  for attempt in $(seq 1 40); do
    if docker compose exec -T "$1" node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" < /dev/null; then return 0; fi
    sleep 3
  done
  return 1
}
trap 'rollback; rm -f "$archive"' HUP INT TERM
# Do not delete the environment file or persistent volumes.
tar -xzf "$archive" -C /opt/findbox
# Retire the exposed antenna artwork from previous releases.
rm -f -- public/media/objects/nfc-640.webp public/media/objects/nfc-1280.webp
if ! (docker compose build web api migrate && docker compose run --rm migrate && roll api && roll api2 && docker compose up -d --no-deps --no-build web); then rollback; exit 1; fi
# Private AI model service for the company assistant. FindBox keeps working if it cannot start.
docker compose up -d --no-deps ollama || echo "Assistant model service did not start; the assistant stays in rules mode."
healthy=false
for attempt in $(seq 1 40); do
 if docker compose exec -T api node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then healthy=true; break; fi
 sleep 3
done
if [ "$healthy" != true ]; then rollback; exit 1; fi
curl --fail --retry 5 --retry-delay 3 --silent https://findbox.africa/api/health >/dev/null || { rollback; exit 1; }
# Keep the server's own safety net (swap, backup and watchdog timers) in step with this release.
/bin/sh deploy/host-setup.sh || echo 'Server setup step did not complete; the site is deployed.' >&2
printf 'Production frontend and backend deployed successfully.\n'
