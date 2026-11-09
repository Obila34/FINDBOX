const KEY = 'fb-installed-app'

/** True inside the installed (home-screen) FindBox app. The app opens with ?source=homescreen, which we remember for the visit. */
export function isInstalledApp(): boolean {
  try { if (new URLSearchParams(location.search).get('source') === 'homescreen') sessionStorage.setItem(KEY, '1') } catch { /* storage blocked */ }
  if (typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) return true
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}

const APP_AUTH = /^\/app\/(sign-in|sign-up|forgot|reset|verify)(\/|$)/

/**
 * Pages of the family app (signed-in /app pages, or anything inside the installed app).
 * These never show the website's navigation or footer: the app stays the app.
 */
export function isAppPage(path: string = location.pathname): boolean {
  return isInstalledApp() || (/^\/app(\/|$)/.test(path) && !APP_AUTH.test(path))
}
