// After a release, a tab opened earlier still asks for the previous release's file names.
// Those no longer exist, so the import fails. Reload once to pick up the new release
// instead of showing an error; the guard stops a reload loop if the network is really down.
const KEY = 'fb-stale-reload'

export function isStaleBuildError(error: unknown): boolean {
  const text = String((error as { message?: string })?.message ?? error)
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported|Loading chunk|Unable to preload CSS|MIME type/i.test(text)
}

export function reloadForNewRelease(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch { /* storage blocked: still reload once */ }
  void navigator.serviceWorker?.getRegistration?.().then(r => r?.waiting?.postMessage({ type: 'SKIP_WAITING' })).catch(() => {})
  window.location.reload()
  return true
}

export function watchForNewRelease() {
  window.addEventListener('vite:preloadError', event => {
    if (reloadForNewRelease()) event.preventDefault()
  })
}
