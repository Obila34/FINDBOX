# FindBox, presentation MVP

A working, interactive frontend prototype of the School Lost & Found system described in *SLF Digital System Proposal*, branded from *FindBox Brand Mockup.pdf*. Three surfaces share one dataset and one state machine:

| Surface | Route | Audience |
| --- | --- | --- |
| Public landing page | `/` | Anyone |
| Installable PWA | `/app` | Parents / guardians and students |
| School workspace | `/manage` | Lost Property staff and school management |

Everything runs in the browser. There is **no backend, no real authentication, no email, no push infrastructure and no real school data**. All people and events are invented.

## Run

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # type-check + production build to dist/
npm run preview      # serve dist/ on http://localhost:4173 (PWA + service worker active)
npm run shots        # screenshots at 390 / 1440 px into shots/ (needs preview running and a local Chrome/Edge)
```

Requires Node 20+.

## Demo entry points

- **Presenter path**: `/` → *Explore the demo* → `/demo`. Choose a persona or a story. This turns on the floating **presenter switcher** (Parent, Student, Lost Property Staff, School Manager), plus *Reset* and *Guide*.
- **Normal app path** (what an installed PWA shows): `/app` → welcome screen → *Sign in* or *Create account*.
  - Sign in: pick a preset family account, or type its email with any password of 4+ characters.
    - `amina@family.demo` (parent of Zuri 5B and Kito 2A)
    - `zuri@student.demo` (student, Year 5)
    - `kito@student.demo` (student, Year 2, restricted preview)
  - Create account: four-step local sign-up (role, details, school/child, done) then onboarding.
  - Staff / manager: `/app/invite` → pick a preseeded school account or redeem `STAFF-2026` / `MANAGE-2026`. Staff never self-assign through public sign-up.
- **Sign out**: side rail / account page (family) or header (school). Returns to the welcome screen; the session and data stay on the device.
- **Reset**: presenter switcher → *Reset*, `/demo` → *Reset demo*, or Account → *Reset demo data*. *Clear everything* also drops local accounts and photos.

## The three scripted stories

1. **Registered water bottle.** Parent reports *Blue steel water bottle* lost → staff *Scan tag* (`FB-7K2M-Q4`, camera or manual) and log where found → staff *Confirm match* (family notified) → *Arrange pickup* → at pickup, *Verify and record return* (method + explicit release checkbox). The manager dashboard updates immediately.
2. **Unregistered pencil case.** Already in the gallery as `FB-0141`. Parent → Gallery → *This is ours* → describe a distinguishing detail. Staff → case → *Start review* → *Verify* (note + "I compared" checkbox) or *Reject* (reason; item relisted, claimant told) → pickup → return.
3. **A student finds a book.** Student → *Found something* → describe the atlas, found in the library. Staff → queue *Handovers* → *Scan its tag* (`FB-4R8N-A2`) with the handover selected → custody confirmed, student credited +25 (*Helpful finder* token settles in Quest). Confirm match → pickup → return → student gets *Full circle* +15. The owner is never shown to the finder.

Step-by-step versions with persona jumps live at `/demo`.

## Architecture

```
src/
  domain/        types.ts (models), transitions.ts (pure state machine with guards), permissions.ts (capabilities + matrix),
                 quest.ts (deterministic point rules, idempotent ledger), labels.ts (user-facing labels, tones)
  data/seed.ts   the shared demo world (invented people, items, cases, notifications, ledger, accounts)
  store/         zustand store persisted to localStorage (`findbox.v1`), versioned; reseeds on version change
  components/    brand (traced logo/emblem), ui primitives, layout shells, hero scene
  pages/         landing, demo, auth, family (parent + student shared), student, staff, management
  styles/        tokens.css (all design tokens), base.css (Tailwind layers + motion utilities)
public/brand     logo.svg, logo-inverted.svg, logo-mono.svg, mark*.svg
public/icons     PWA icons (192, 512, maskable 512, apple-touch-icon, favicon)
```

Libraries and why: **React 19 + TypeScript + Vite 6** (required); **Tailwind 3** wired to CSS custom properties so tokens have one source; **react-router 7** for real routes; **zustand** with `persist` for a tiny typed store; **qrcode** to render real QR images (encoding only `https://findbox.demo/t/<token>`); **jsqr** for real camera scanning, lazy-loaded; **recharts** for the two dashboard charts (custom bars elsewhere); **lucide-react** icons; **vite-plugin-pwa** (Workbox) for the manifest, precache and offline shell; **@fontsource** self-hosted Cormorant Garamond and Inter Variable so the app works offline without a font CDN.

### Item and case states

Registered item: `with_owner → reported_lost → potential_match → match_confirmed → awaiting_collection → returned`. Staff can also log a found registered item that was never reported lost (case kind `found_registered`, starting at `potential_match`).

Unregistered find: `found_unregistered → claim_submitted → claim_under_review → claim_verified → awaiting_collection → returned`, with rejection relisting the item (`found_unregistered`) and notifying the claimant.

Student handover: `handover_pending → closed` when staff log the item with that handover selected; the finder is credited only then.

Guards live in `src/domain/transitions.ts` and throw human-readable messages that surface as toasts. A QR scan or gallery claim never releases property: `confirmReturn` requires `awaiting_collection`, a verification method, an explicit checkbox and an authorised account (`school.staffCanVerifyCollection` or a manager).

### Quest ledger

`award(ledger, entry)` is idempotent on a deterministic key (`register:<itemId>`, `relabel:<itemId>`, `handover:<caseId>`, `return:<caseId>`, `profile:<studentId>`). Rules and tiers are in `src/domain/quest.ts` and shown in the UI. No points for losing, claiming, unverified finds or item value. No public rankings.

## Route inventory

| Route | Screen | Roles |
| --- | --- | --- |
| `/` | Landing (halftone hero, numbered steps, scroll-driven story band, roles, quest, trust, install) | public |
| `/demo` | Presenter guide, scenarios, permission matrix | public |
| `/app` | Entry: welcome for fresh visitors, home for sessions | public |
| `/app/welcome`, `/app/sign-in`, `/app/sign-up`, `/app/forgot`, `/app/invite` | Auth | public |
| `/app/onboarding` | Onboarding slides | parent, student |
| `/app/home` | Parent dashboard / student inventory shelf | parent, student |
| `/app/items`, `/app/items/:id` | Belongings list, item detail (tag card, print/share, relabel, edit, history) | parent, student |
| `/app/register` | Guided registration + QR tag | parent, student (if enabled) |
| `/app/report`, `/app/report/:id` | Report lost | parent, student (if enabled) |
| `/app/gallery`, `/app/gallery/:id/claim` | Found Items Gallery (safe view), claim form | parent, student (claim if enabled) |
| `/app/cases/:id` | Family-facing case timeline | parent, student |
| `/app/inbox` | Local simulated notifications | parent, student |
| `/app/quest` | Quest Board (private) | student |
| `/app/found` | Helpful finder report | student |
| `/app/account` | Account, sign out, reset | parent, student |
| `/manage` | Staff queue (tabs, counts, search, sort) | staff, manager |
| `/manage/scan` | Camera QR scan, manual entry, NFC simulation | staff |
| `/manage/log` | Log unregistered find | staff |
| `/manage/cases/:id` | Case detail: compare, confirm/reject, claims, pickup, verify + return | staff, manager |
| `/manage/gallery` | Staff gallery | staff, manager |
| `/manage/activity` | Alerts + cross-case event feed | staff, manager |
| `/manage/dashboard` | Management metrics, trends, drill-down | manager |
| `/manage/settings` | Configuration preview (demo) | manager |

The role-permission matrix is rendered at `/demo` and defined in `src/domain/permissions.ts`.

## Brand and design tokens

See `DESIGN_SYSTEM.md`. Palette values were sampled from the brand PDF (primary `#0d6166`, `#13868e`, `#33bab7`, `#04414c`, `#073847`, tile `#e4e5e8`). The wordmark was traced from the PDF's embedded Minion glyph outlines and the emblem's 15 hairline rings from its vector data; both are rendered inline by `Logo`/`Mark` and exported as SVG/PNG.

## Hosting

Static host with SPA fallback (every unknown path serves `index.html`). Examples: Netlify `_redirects` → `/* /index.html 200`; Vercel `rewrites`; GitHub Pages needs a 404 → index copy. **HTTPS is required** for installation and camera access (localhost is exempt). After deploying, open the URL on a phone:

- **Android Chrome**: menu → *Add to Home screen* / *Install app* (the page also offers *Install now* when the browser fires the install prompt).
- **iOS Safari**: Share → *Add to Home Screen*. iOS never shows an automatic prompt; other iOS browsers cannot install.

The installed app launches at `/app` (welcome screen). The service worker precaches the shell, fonts and icons, so the demo keeps working without a connection once loaded. Offline changes persist only in that device's local storage.

## Simulated versus real

| Real in this prototype | Simulated / not present |
| --- | --- |
| Full state machine with guards, event history, persistence on device | Authentication (local demo identities; passwords never stored or checked) |
| QR generation (opaque token only) and camera scanning via jsQR | NFC (labelled simulation picks a registered NFC item) |
| Installable PWA: manifest, icons, service worker, offline shell | Email, push, SMS (local inbox stands in) |
| Reduced-motion, keyboard, focus management, semantic dialogs | Hosting, HTTPS, multi-device sync, backend, real school data |
| Metrics computed from live cases | External integrations, house-points export (shown as a future option) |

## Verification performed

- `npm run build` (TypeScript strict + Vite production build) passes; the service worker precaches 52 entries.
- `npm test` runs `src/domain/transitions.test.ts`: all three stories through the state machine, plus guards (no release before pickup, unauthorised release refused, claim cannot skip review, finder credited once and only after staff confirm, duplicate tag refused, no owner identity in finder notifications).
- Manual flow checks in a desktop Chromium via Playwright at 390 and 1440 px: landing, welcome/sign-in, student home, parent home, staff queue/scan/case, manager dashboard (screenshots in `shots/` when `npm run shots` is run).
- Not verified here: installation on a physical Android or iOS device, real camera permission prompts on phones, NFC hardware, behaviour behind a specific host's SPA fallback. These depend on the deployment and device.

## Visual assets and where they come from

- **Ambient video**: two client-supplied CloudFront clips (`src/data/media.ts`). Swap for the school's own footage before a public launch.
- **Photography**: Unsplash (free licence, hotlinking permitted). IDs are listed in `src/data/media.ts`; every image has a gradient fallback.
- **Orb, 3D icon tiles, glass surfaces, animated buttons**: built in CSS/SVG (`Orb.tsx`, `Icon3D.tsx`, `effects.css`), nothing to download.

Recommended sources for richer assets: Unsplash and Pexels (photos, video), Spline (interactive 3D you can embed in React), 3dicons.co (free CC0 3D icon pack), Icons8 3D, LottieFiles and Rive (animated states), Haikei (mesh and blob backgrounds). The list is also shown at `/demo`.
