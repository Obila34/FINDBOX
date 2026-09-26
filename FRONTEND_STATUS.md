# FindBox frontend

The React frontend now uses a shared green-and-white app shell for students, parents, teachers, and school administrators. The sign-in screen retains the sample accounts. School permissions and existing item registration, reporting, matching, claims, and handover workflows remain in place.

## Implemented

- Image-led, responsive how-it-works grid, interactive steps, community cards, app showcase, FAQ, and multi-column footer.
- Live clockwise product orbit, scroll response, object selection, rotation controls, reduced-motion support, and off-screen rendering pause.
- Clear bottle, circular NFC sticker, black keyring tracker, two human companions, and a replacement inventory render library. PNG exports include 512 px and 4096 px versions.
- Supplied luminous orb design adapted as a green animated brand icon; static versions are used for the installed app, printing, and favicon. It does not request microphone access.
- Daily streak check-ins, rolling week, personal best, milestones, account-specific persistence, and date-boundary tests. The old Quest page redirects to Streaks; its historic ledger is preserved internally.
- A public tag landing route that exposes no owner details.

## Backend integration boundary

Sample account access and data are local to the browser. Online password authentication, school identity verification, remote persistence, email recovery, push delivery, and physical NFC reading are not connected. The frontend does not claim successful remote authentication or email delivery. These services must be connected before a real school rollout. Camera QR scanning and on-device item workflows remain functional.

## Installed app and mobile update

- Home-screen launches open sign-in, with a visible sign-up tab. The legacy `/app` entry and standalone iOS bookmarks opening `/` use the same entry. Existing saved data is retained.
- New accounts can sign in on the same device using their email, selected role, and password. Passwords use salted PBKDF2 hashes; plaintext passwords are not persisted. This is a frontend convenience, not server authentication or an authorization boundary. Sample users remain available separately.
- Mobile navigation uses a floating white dock, circular line icons, a brand-green active marker, accessible link names, and safe-area spacing.
- Registered bottle, fleece, workbook, and lunchbox cards use new colorful product photographs. Responsive WebP files are 8–27 KB at 480 px. User-uploaded item photos take priority. Original artwork is retained in `assets/catalog-originals` and original 4K product exports are unchanged.
- Routes load separately. Mobile 3D companions and product viewers load when opened; their interactive features remain available. The marketing hero retains its live 3D orbit.
- Offline precaching is approximately 1.7 MiB, down from approximately 15.3 MiB (89% smaller), including sharper images for high-density phones. The sign-in entry no longer downloads the 3D engine, marketing page, or charts. Optional scenes and charts require an initial online load before they can be used offline. New app versions offer an Update button.
- `vercel.json` serves app deep links through Vite's entry HTML and avoids stale service-worker and manifest caching. Redeploy this build to apply the changes to an installed app. Existing installations should be opened online to receive the update. Live deployment and a physical-device install still need verification against the actual Vercel URL.

## Asset fidelity

The supplied JPGs are visual references, not meshes. The product and human models are original procedural reconstructions. They are interactive 3D, but the human models are not exact replicas of the supplied character artwork. Exact character fidelity requires the original GLB/FBX meshes or a dedicated modelling and rigging pass. Replace the implementations in `src/components/scene/ReferenceCharacters.tsx` with those assets when available.

## Validation

`npm run build`, `npm test`, and `node scripts/production-check.mjs` validate the build, return workflows, streak date rules, account roles, local persistence, mobile/desktop layouts, and visible copy. Asset generation is reproducible with `node scripts/render-products.mjs` and `node scripts/render-orb-icons.mjs` while Vite runs at port 4175.

For production PWA checks, run `npm run preview -- --host 127.0.0.1 --port 4177`, then `node scripts/pwa-check.mjs`. It checks service-worker control, manifest icons, launch routing, offline inventory and reload, offline sign-up, rejected incorrect passwords, successful password sign-in, persistence, and legacy iOS entry behavior. The 48-screen production check also defaults to port 4177. Both scripts accept `TEST_ORIGIN`. Responsive image conversions can be regenerated with `node scripts/optimize-product-images.mjs`.
