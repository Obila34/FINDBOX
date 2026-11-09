// Branded HTML for every FindBox email. The plain-text body stays the source of truth (it is also sent
// as the text part); this wraps it in the FindBox look: green wordmark header, a clear action button
// for the main link, and the same signature as the website footer. Everything is escaped and inline-styled
// so it renders in Gmail, Outlook and phone mail apps.
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const URL_RE = /https?:\/\/[^\s<>"')]+[^\s<>"').,;:!?]/g;

function actionLabel(subject, url) {
  const s = `${subject} ${url}`.toLowerCase();
  if (/reset/.test(s)) return "Reset your password";
  if (/verif/.test(s)) return "Verify your email";
  if (/school-invitation|school access|teacher|administrator/.test(s)) return "Accept the invitation";
  if (/invite|invitation|join/.test(s)) return "Join FindBox";
  if (/order|receipt|payment/.test(s)) return "View your order";
  if (/collect|found|ready/.test(s)) return "See the details";
  return "Open FindBox";
}

const FONT = "Arial,Helvetica,sans-serif";
const GREEN = "#657b56", NIGHT = "#050806", CREAM = "#e7ecde", INK = "#1d2a22", MUTED = "#5f6b5a";

/** A big monospace-friendly code block (for sign-in codes). */
export function codeBlock(code) {
  return `<div style="margin:22px 0;padding:18px;border-radius:16px;background:#f3f5ee;border:1px solid #dde3d4;text-align:center;font:700 32px/1 ${FONT};letter-spacing:10px;color:${INK}">${esc(code)}</div>`;
}

export function renderEmail({ subject, text, origin = "https://findbox.africa", extraHtml = "" }) {
  const base = String(origin || "https://findbox.africa").replace(/\/$/, "");
  const urls = String(text).match(URL_RE) || [];
  const primary = urls[0];
  const paragraphs = String(text).trim().split(/\n\s*\n/).map((p) => {
    const html = esc(p).replace(/\n/g, "<br>").replace(URL_RE, (u) => {
      const raw = u.replace(/&amp;/g, "&");
      return `<a href="${esc(raw)}" style="color:${GREEN};text-decoration:underline;word-break:break-all">${u}</a>`;
    });
    return `<p style="margin:0 0 16px;font:15px/1.6 ${FONT};color:${INK}">${html}</p>`;
  }).join("");
  const button = primary ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 22px"><tr><td style="border-radius:999px;background:${NIGHT}">
      <a href="${esc(primary)}" style="display:inline-block;padding:14px 26px;font:700 14px/1 ${FONT};color:${CREAM};text-decoration:none;border-radius:999px">${esc(actionLabel(subject, primary))} &rarr;</a></td></tr></table>` : "";
  const year = new Date().getFullYear();
  const link = (path, label) => `<a href="${base}${path}" style="color:${CREAM};text-decoration:none;font:13px/1.9 ${FONT}">${label}</a>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#eef1e8">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(String(text).split("\n")[0].slice(0, 140))}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1e8"><tr><td align="center" style="padding:28px 14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="background:${NIGHT};border-radius:22px 22px 0 0;padding:24px 30px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td><a href="${base}/" style="text-decoration:none"><img src="${base}/icons/icon-192.png" width="34" height="34" alt="" style="vertical-align:middle;border-radius:8px;border:0">
        <span style="vertical-align:middle;margin-left:12px;font:300 24px/1 ${FONT};letter-spacing:3px;color:${GREEN}">FIND<b style="font-weight:700">BOX</b></span></a></td>
      <td align="right" style="font:11px/1 ${FONT};letter-spacing:2px;text-transform:uppercase;color:#9da59a">School lost &amp; found</td>
    </tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;padding:34px 30px 18px">
    <h1 style="margin:0 0 18px;font:400 26px/1.15 ${FONT};letter-spacing:-.6px;color:${INK}">${esc(subject)}</h1>
    ${paragraphs}${extraHtml}${button}
    <p style="margin:6px 0 0;padding-top:18px;border-top:1px solid #e4e9dc;font:13px/1.6 ${FONT};color:${MUTED}">Warm regards,<br><strong style="color:${INK}">The FindBox team</strong><br>Made in Kenya. Built by parents.</p>
  </td></tr>
  <tr><td style="background:${NIGHT};border-radius:0 0 22px 22px;padding:28px 30px">
    <p style="margin:0 0 4px;font:400 20px/1.25 ${FONT};letter-spacing:-.4px;color:#f8f9f3">Every lost item finds its way back home.</p>
    <p style="margin:0 0 18px;font:13px/1.6 ${FONT};color:#9da59a">Labels, accounts and school collection points working together in one return system.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
      <td valign="top" style="padding-right:12px">${link("/#how-it-works", "How it works")}<br>${link("/shop", "The tag store")}<br>${link("/schools", "For your school")}</td>
      <td valign="top" style="padding-right:12px">${link("/app/sign-in", "Log in")}<br>${link("/contact", "Contact us")}<br>${link("/privacy", "Privacy")}</td>
      <td valign="top"><a href="mailto:hello@findbox.africa" style="color:${CREAM};text-decoration:none;font:13px/1.9 ${FONT}">hello@findbox.africa</a></td>
    </tr></table>
    <p style="margin:22px 0 0;font:300 44px/1 ${FONT};letter-spacing:5px;color:${GREEN}">FIND<b style="font-weight:700">BOX</b><sup style="font-size:14px;letter-spacing:0">&reg;</sup></p>
    <p style="margin:12px 0 0;font:11px/1.6 ${FONT};color:#78806f">&copy; ${year} FindBox. Built for school communities. You are receiving this because of your FindBox account or your school's use of FindBox.</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}
