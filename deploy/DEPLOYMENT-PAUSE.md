# Production deployment paused

The owner explicitly paused deployment on 8 November 2026 while preparing major fixes. Keep the current live website and its services running. Do not deploy application changes until the owner explicitly asks to resume.

Checks and builds remain enabled. The deployment job requires the GitHub repository variable FINDBOX_AUTO_DEPLOY to equal true; it is currently false. The server also has /opt/findbox-deploy-paused, which the release receiver checks before accepting an archive. This prevents old workflow reruns from deploying around the GitHub gate.

Resume only after explicit owner instruction: remove the server pause marker, set FINDBOX_AUTO_DEPLOY to true, and deploy the intended reviewed revision. Do not treat an ordinary request to edit or fix code as permission to resume deployment.
