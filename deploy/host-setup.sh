#!/bin/sh
# One server has to hold everything, so the server itself is set up to survive trouble.
# Safe to run again and again; runs at the end of every deploy.
#   - swap, so a memory spike slows things down instead of stopping the database
#   - backups every six hours, with a daily restore test
#   - a watchdog that restarts anything that has stopped or stopped answering
#   - a second API instance
set -eu
cd /opt/findbox

# 1. Swap: 4 GB, used only under pressure.
if ! swapon --show | grep -q .; then
  if [ ! -f /swapfile ]; then fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null; fi
  swapon /swapfile
  grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
printf 'vm.swappiness=10\nvm.overcommit_memory=1\n' > /etc/sysctl.d/90-findbox.conf
sysctl -q -p /etc/sysctl.d/90-findbox.conf || true

# 2. A key for encrypting off-site backups. Created once; the owner must keep a copy elsewhere.
if [ ! -s /opt/findbox-backup.key ]; then (umask 077; openssl rand -base64 48 > /opt/findbox-backup.key); fi

# 3. Timers.
unit() { printf '%s\n' "$2" > "/etc/systemd/system/$1"; }
unit findbox-backup.service '[Unit]
Description=FindBox database backup
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/findbox
ExecStart=/bin/sh /opt/findbox/deploy/backup.sh
UMask=0077'
unit findbox-backup.timer '[Unit]
Description=FindBox database backup, every six hours

[Timer]
OnCalendar=*-*-* 02,08,14,20:00:00 UTC
Persistent=true
RandomizedDelaySec=300

[Install]
WantedBy=timers.target'
unit findbox-restore-test.service '[Unit]
Description=FindBox backup restore test
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/findbox
ExecStart=/bin/sh /opt/findbox/deploy/restore-test.sh
UMask=0077'
unit findbox-restore-test.timer '[Unit]
Description=Daily FindBox backup restore test

[Timer]
OnCalendar=*-*-* 02:30:00 UTC
Persistent=true

[Install]
WantedBy=timers.target'
unit findbox-watchdog.service '[Unit]
Description=FindBox watchdog
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
WorkingDirectory=/opt/findbox
ExecStart=/bin/sh /opt/findbox/deploy/watchdog.sh'
unit findbox-watchdog.timer '[Unit]
Description=FindBox watchdog, every minute

[Timer]
OnBootSec=90
OnUnitActiveSec=60
AccuracySec=5

[Install]
WantedBy=timers.target'
systemctl daemon-reload
systemctl enable --now findbox-backup.timer findbox-restore-test.timer findbox-watchdog.timer >/dev/null 2>&1
systemctl enable docker >/dev/null 2>&1 || true

# 4. The second API instance (the first is handled by the deploy itself).
docker compose up -d --no-deps --no-build api2 >/dev/null 2>&1 || echo 'Second API instance did not start; the site continues on one.'
printf 'Server setup is in place.\n'
