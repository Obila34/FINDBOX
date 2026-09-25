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

## Asset fidelity

The supplied JPGs are visual references, not meshes. The product and human models are original procedural reconstructions. They are interactive 3D, but the human models are not exact replicas of the supplied character artwork. Exact character fidelity requires the original GLB/FBX meshes or a dedicated modelling and rigging pass. Replace the implementations in `src/components/scene/ReferenceCharacters.tsx` with those assets when available.

## Validation

`npm run build`, `npm test`, and `node scripts/production-check.mjs` validate the build, return workflows, streak date rules, account roles, local persistence, mobile/desktop layouts, and visible copy. Asset generation is reproducible with `node scripts/render-products.mjs` and `node scripts/render-orb-icons.mjs` while Vite runs at port 4175.
