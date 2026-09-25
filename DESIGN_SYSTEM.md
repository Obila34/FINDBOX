# FINDBOX studio redesign

The supplied Axion Studio reference is adapted to FINDBOX's school lost-and-found content and existing routes.

## Visual system

- FindBox teal #0D6166 actions, deep teal #073847, white surfaces, #F5F5F5 page backgrounds.
- System sans-serif type, medium-weight headings, tight tracking, 1440px maximum content width.
- Pill navigation and buttons, 16px cards, subtle borders and generous space.
- Breakpoints: 640, 768, 1024 and 1280px. The existing xs breakpoint remains at 360px.
- Rolling button text and rotating arrow discs use 500ms motion. Reduced-motion preferences are respected.
- Existing teal token names are compatibility aliases for the new palette; status green, amber, purple and red retain their meanings.

## Screens

Landing: full-height shader hero, asymmetric introduction, two featured workspace cards, installation action in the footer.
Authentication: shared editorial split layout for welcome, sign-in, sign-up, invitations, recovery and onboarding.
Workspaces: shared pill header for families, students, staff and managers; mobile family navigation and accessible menu sheets.
All existing forms, galleries, inventory, case timelines, Quest, management charts and settings use the shared palette and components.

## Media and runtime

Hero uses shaders/react: Swirl, ChromaFlow, FlutedGlass and FilmGrain with the reference parameters and the FindBox teal palette. The GPU module is lazy loaded. Static CSS artwork remains available during loading, without GPU support, or with reduced motion. Shader telemetry is disabled; animation unmounts outside the viewport or when the document is hidden.

The navigation mark is the animated geometric orb supplied for this revision, rendered in brand teal with the mockup's pale ring color. A matching static orb is used while Three.js loads, for reduced-motion contexts, and in installed-app icons.

School photography is bundled under public/media, sourced from the existing Unsplash selections. Local copies avoid third-party image requests and are included in the service-worker cache.
Live clocks show Nairobi time to match the school context.

Existing role permissions, local demo storage, QR flows, notifications, claims and verified handovers are preserved.

## Verification

npm run build
npm test
node scripts/redesign-check.mjs (with the preview running on port 4175)
npm run shots (defaults to port 4173; BASE can override)

The shader engine creates a large, separate bundle; it is not required to render the application or its fallback artwork.
