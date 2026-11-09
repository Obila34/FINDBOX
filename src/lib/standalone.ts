const KEY = 'fb-installed-app'

/** True inside the installed (home-screen) FindBox app. The app opens with ?source=homescreen, which we remember for the visit. */
export function isInstalledApp(): boolean {
  try { if (new URLSearchParams(location.search).get('source') === 'homescreen') sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ }
  if (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}
