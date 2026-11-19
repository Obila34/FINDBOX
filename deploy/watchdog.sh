#!/bin/sh
# Runs every minute. Docker restarts a container that exits, but not one that is running and broken.
# This brings back anything that is missing and restarts an API instance that has stopped answering.
set -u
cd /opt/findbox
# Never interfere with a deploy that is in progress.
exec 9>/opt/findbox-deploy.lock
flock -n 9 || exit 0
state() { docker inspect -f "$1" "findbox-$2-1" 2>/dev/null || echo missing; }
for svc in db api api2 web ollama; do
  running=$(state '{{.State.Running}}' "$svc")
  if [ "$running" != "true" ]; then
    echo "watchdog: $svc is not running; starting it"
    docker compose up -d --no-deps --no-build "$svc" >/dev/null 2>&1 || echo "watchdog: could not start $svc"
    continue
  fi
  case "$svc" in api|api2)
    if [ "$(state '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$svc")" = "unhealthy" ]; then
      echo "watchdog: $svc is unhealthy; restarting it"
      docker compose restart -t 20 "$svc" >/dev/null 2>&1 || echo "watchdog: could not restart $svc"
    fi;;
  esac
done
