# Production deployment paused

The owner explicitly paused deployment on 8 November 2026 while preparing major fixes. Keep the current live website and its services running. Do not deploy application changes until the owner explicitly asks to resume.

Checks and builds remain enabled. The deployment job requires the GitHub repository variable FINDBOX_AUTO_DEPLOY to equal true; it is currently false. The server also has /opt/findbox-deploy-paused, which the release receiver checks before accepting an archive. This prevents old workflow reruns from deploying around the GitHub gate.

Resume only after explicit owner instruction: remove the server pause marker, set FINDBOX_AUTO_DEPLOY to true, and deploy the intended reviewed revision. Do not treat an ordinary request to edit or fix code as permission to resume deployment.

## Full system pause

Later on 8 November 2026, the owner explicitly requested the whole website and application to be paused. A fresh database backup was taken first. The web, API (including its worker) and database containers are stopped; volumes and accounts are preserved. The server marker /opt/findbox-system-paused records this pause. The findbox-backup.timer and three laptop FindBox scheduled tasks have been paused to avoid jobs against the offline system. Task states were saved locally in the user's .findbox-backups/tasks-before-system-pause.json.

Do not restart application containers, background jobs, timers, or deployments until the owner explicitly requests resumption. An ordinary request for code fixes does not resume the system. The VPS/SSH remain available for maintenance.
