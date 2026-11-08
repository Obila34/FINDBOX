// Each kind of user signs in through its own portal with its own session cookie and rules.
// family: parents and students · school: teachers and school administrators · ops: company and developer.
export const PORTALS = ['family', 'school', 'ops'];
export const COOKIE = { family: 'findbox_session', school: 'findbox_school_session', ops: 'findbox_ops_session' };
export const DEVICE_COOKIE = 'findbox_device';
export const PORTAL_SIGN_IN = { family: '/app/sign-in', school: '/school/sign-in', ops: '/company' };

const HOUR = 3600000, DAY = 24 * HOUR;
/** How long a fully signed-in session lasts before activity is needed again. */
export const SESSION_MS = { family: 30 * DAY, school: 12 * HOUR, ops: 8 * HOUR };
/** Family sessions renew while used, but never beyond this from the original sign-in. */
export const FAMILY_ABSOLUTE_MS = 90 * DAY;
export const TRUSTED_DEVICE_MS = 30 * DAY;

export function naturalPortal(u, companyRole) {
  if (companyRole) return 'ops';
  if (['staff', 'manager'].includes(u.role)) return 'school';
  return 'family';
}

/** The portal the browser is working in, sent by the app on every request. */
export function requestPortal(req) {
  const p = String(req.headers['x-findbox-portal'] || '');
  return PORTALS.includes(p) ? p : null;
}

/** Session token for this request: the current portal's cookie, or any session cookie for API clients. */
export function sessionToken(req) {
  const p = requestPortal(req);
  if (p) return req.cookies[COOKIE[p]] || '';
  return req.cookies[COOKIE.ops] || req.cookies[COOKIE.school] || req.cookies[COOKIE.family] || '';
}

export function cookieOptions(cfg, maxAgeSeconds) {
  return { path: '/', httpOnly: true, secure: cfg.production, sameSite: 'lax', maxAge: maxAgeSeconds };
}

/** A short readable device label from the user agent, e.g. "Chrome on Windows". */
export function deviceLabel(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : 'unknown device';
  return `${browser} on ${os}`;
}
