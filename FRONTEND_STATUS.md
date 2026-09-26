# FindBox frontend

The React frontend now uses a shared green-and-white app shell for students, parents, teachers, and school administrators. The sign-in screen retains the sample accounts. School permissions and existing item registration, reporting, matching, claims, and handover workflows remain in place.

## Implemented

- Image-led, responsive how-it-works grid, interactive steps, community cards, app showcase, FAQ, and multi-column footer.
- Clockwise photographic product orbit, scroll response, object selection, pause control, reduced-motion support, and off-screen animation pause.
- Generated high-resolution transparent product photographs replace the bottle, NFC sticker and tracking-tag models across the hero, showcase, dashboard, inventory and detail views. Product detail images have a closer-look toggle. Originals and prompts are in `assets/product-originals`, with responsive WebP files in `public/media/objects`.
- The FINDBOX wordmark is shared across headers, footers, app icons, printable tags, and favicon. The orb has been removed.
- A newly generated illustrated human companion replaces the procedural characters throughout the site and app. It retains a reduced-motion-aware greeting interaction. Original artwork and its generation prompt are in `assets/avatar-originals`; compressed transparent WebP assets are in `public/media/avatars`.
- Typography uses Arial/Helvetica consistently, including navigation and formerly serif heading accents. Mobile dock icons share equal-width grid columns for every role.
- Daily streak check-ins, rolling week, personal best, milestones, account-specific persistence, and date-boundary tests. The old Quest page redirects to Streaks; its historic ledger is preserved internally.
- A public tag landing route that exposes no owner details.

## Backend integration boundary

Sample account access and data are local to the browser. Online password authentication, school identity verification, remote persistence, email recovery, push delivery, and physical NFC reading are not connected. The frontend does not claim successful remote authentication or email delivery. These services must be connected before a real school rollout. Camera QR scanning and on-device item workflows remain functional.

## Installed app and mobile update

- Home-screen launches open sign-in, with a visible sign-up tab. The legacy `/app` entry and standalone iOS bookmarks opening `/` use the same entry. Existing saved data is retained.
- New accounts can sign in on the same device using their email, selected role, and password. Passwords use salted PBKDF2 hashes; plaintext passwords are not persisted. This is a frontend convenience, not server authentication or an authorization boundary. Sample users remain available separately.
- Mobile navigation uses a floating white dock, circular line icons, a brand-green active marker, accessible link names, and safe-area spacing.
- Registered bottle, fleece, workbook, and lunchbox cards use new colorful product photographs. Responsive WebP files are 8–27 KB at 480 px. User-uploaded item photos take priority. Original artwork is retained in `assets/catalog-originals` and original 4K product exports are unchanged.
- Routes load separately. Products and companions use responsive images rather than live 3D scenes. The Three.js engine is no longer emitted in the site build. Offline precaching is approximately 2.1 MiB, including sharp product images for high-density phones, compared with approximately 15.3 MiB before optimization. Charts require an initial online load before use offline. New app versions offer an Update button.
- `vercel.json` serves app deep links through Vite's entry HTML and avoids stale service-worker and manifest caching. Redeploy this build to apply the changes to an installed app. Existing installations should be opened online to receive the update. Live deployment and a physical-device install still need verification against the actual Vercel URL.

## Asset fidelity

The product JPGs inspired the generated product photographs. The companion is a generated editorial illustration. Retired renders are archived outside the public deployment folder in `assets/retired-characters` and `assets/retired-products`. The QR graphic in the bottle photograph is illustrative; functional tags continue to be generated from item records.

## Validation

`npm run build`, `npm test`, and `node scripts/production-check.mjs` validate the build, return workflows, streak date rules, account roles, local persistence, mobile/desktop layouts, and visible copy. Product exports use `node scripts/render-products.mjs` while Vite runs at port 4175. Wordmark icons and avatar compression use `node scripts/build-brand-assets.mjs`.

For production PWA checks, run `npm run preview -- --host 127.0.0.1 --port 4177`, then `node scripts/pwa-check.mjs`. It checks service-worker control, manifest icons, launch routing, offline inventory and reload, offline sign-up, rejected incorrect passwords, successful password sign-in, persistence, and legacy iOS entry behavior. The 48-screen production check also defaults to port 4177. Both scripts accept `TEST_ORIGIN`. Responsive image conversions can be regenerated with `node scripts/optimize-product-images.mjs`.
