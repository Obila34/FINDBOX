# FindBox image brief

Use this with ChatGPT (or any image model) to produce the replacement photographs for findbox.africa.
Generate each image separately: paste the **master prompt**, then the **shot prompt** for that image.
Save each result with the exact file name given, as WebP (or PNG) at the size listed, and send them back.
They go into `public/media/brand-v2/` and are wired up in `src/data/imagery.ts`.

## Rules every image must follow

1. **No people, no hands, no faces, no silhouettes.** Belongings, labels and school spaces only.
2. **Hard items carry a FindBox QR sticker**: bottles, lunchboxes, exercise books, pencil cases, calculators, chargers.
3. **Clothing carries a FindBox woven fabric tag sewn at the inside back of the collar**: shirts, sweaters, blazers, tracksuit tops, PE shirts. Never a sticker on fabric, never a keyring on clothing.
4. No other brands, logos or readable text, except the small "FINDBOX" wordmark on the tags.
5. No AirTags, Bluetooth trackers or keyring fobs.
6. Kenyan school context: green, navy or maroon uniforms; plain wooden furniture; natural daylight.

## Master prompt (paste first, every time)

> Photorealistic editorial product photograph for a premium school lost-and-found brand called FindBox, shot on a full-frame camera with a 50mm lens at f/2.8, soft natural window light, gentle shadows, shallow depth of field, true-to-life colours, subtle film grain, calm and uncluttered composition with negative space. Setting: a modern, well-kept primary or secondary school in Kenya. Absolutely no people, no hands, no faces and no body parts anywhere in the frame. Colour palette: deep forest green (#174c39), muted sage green (#aebe9e), olive green (#657b56), warm cream (#e7ecde), natural oak wood and soft white walls.
>
> FindBox labels look like this and must be drawn accurately:
> **QR sticker**: a small rounded-square vinyl sticker, about 2.5 cm wide, matte cream (#e7ecde) with a crisp black QR code and a tiny "FINDBOX" wordmark in olive green (#657b56) beneath it, applied flat and neatly to hard items.
> **Fabric tag**: a soft woven fabric label, about 4 cm × 2 cm, forest green (#174c39) with a cream woven QR code and a small cream "FINDBOX" wordmark, sewn neatly inside the back of the collar where a size label would normally be.
>
> No other text, logos or brands. No electronic trackers or keyring fobs. Avoid an AI-generated look: realistic textures, natural imperfections, believable scale, no warped objects.

## Shot list

| # | File name | Size | Where it's used |
|---|---|---|---|
| 1 | `hero-uniforms.webp` | 2400 × 1600 | Landing hero |
| 2 | `hero-belongings.webp` | 2400 × 1600 | Landing hero, sign-in |
| 3 | `hero-collar.webp` | 2400 × 1600 | Landing hero, sign-up |
| 4 | `hero-collection-point.webp` | 2400 × 1600 | Landing hero, school portal, company sign-in |
| 5 | `labels-flatlay.webp` | 1600 × 2000 | Landing feature card, schools page |
| 6 | `bottle-sticker.webp` | 1600 × 1600 | Feature cards, journey "Find" |
| 7 | `bottle-left-behind.webp` | 2000 × 1400 | Journey "Lose" |
| 8 | `sticker-applied.webp` | 2000 × 1400 | Journey "Connect" |
| 9 | `phone-scan.webp` | 2000 × 1400 | Journey "Find" |
| 10 | `collection-reception.webp` | 2400 × 1600 | Collection points: reception |
| 11 | `collection-library.webp` | 2400 × 1600 | Collection points: library |
| 12 | `collection-sports.webp` | 2400 × 1600 | Collection points: sports office |
| 13 | `ready-to-go-home.webp` | 2000 × 1400 | Journey "Reunite" |
| 14 | `role-admin.webp` | 2000 × 1400 | Schools page, admin role |
| 15 | `role-staff.webp` | 2000 × 1400 | Schools page, staff role |
| 16 | `role-parent.webp` | 2000 × 1400 | Schools page, parent role |
| 17 | `catalog-bottle.webp` | 1600 × 1600 | Shop |
| 18 | `catalog-lunchbox.webp` | 1600 × 1600 | Shop |
| 19 | `catalog-book.webp` | 1600 × 1600 | Shop |
| 20 | `catalog-sweater.webp` | 1600 × 1600 | Shop |

### Shot prompts

1. **hero-uniforms**: Three neatly folded school uniforms (forest-green V-neck sweater, white shirt, navy blazer) in a shallow oak tray on a sunlit counter, each collar turned slightly open so the FindBox fabric tag is clearly visible. Wide landscape frame, lots of calm space on the left for headline text, soft morning light from the right.
2. **hero-belongings**: A stainless steel water bottle, a sage-green lunchbox, an exercise book and a pencil case arranged on a light oak school desk, each with one FindBox QR sticker clearly visible. Low three-quarter angle, classroom softly out of focus behind, open space on the left.
3. **hero-collar**: Close-up of the inside back collar of a forest-green school sweater lying on cream linen, showing the sewn FindBox fabric tag in sharp focus; knit texture visible; the rest falls into soft focus. Landscape, generous negative space.
4. **hero-collection-point**: An empty, tidy school lost-and-found collection point: a forest-green painted cabinet with open cubbies holding a few labelled items (a bottle and lunchbox with QR stickers, a folded sweater with its collar tag visible), a small wooden sign reading only "COLLECTION POINT", plants, a sunlit corridor behind. No people.
5. **labels-flatlay**: Overhead flat lay on a sage-green surface: a sheet of FindBox QR stickers, a strip of FindBox woven fabric tags, a folded forest-green sweater with the tag at the collar, and a water bottle with a sticker. Portrait orientation, orderly grid, soft shadows.
6. **bottle-sticker**: A single stainless steel or forest-green water bottle standing on a wooden bench, its FindBox QR sticker facing the camera, a blurred school courtyard behind. Square crop, product-hero feel.
7. **bottle-left-behind**: A lone water bottle with a FindBox QR sticker left on a wooden bench in an empty school corridor, late-afternoon light, gentle sense of "forgotten", hopeful not sad. No people.
8. **sticker-applied**: A FindBox QR sticker half-peeled from its backing sheet, resting next to a lunchbox that already wears one, on a kitchen counter in morning light. No hands.
9. **phone-scan**: A smartphone lying on a school desk beside a water bottle with a FindBox QR sticker; the phone screen shows a simple, unbranded green "Item found" confirmation with a tick (no other text). No hands.
10. **collection-reception**: A school reception counter with a labelled oak tray of found items (bottle and pencil case with QR stickers, a folded sweater showing its collar tag), a small "COLLECTION POINT" sign, a calm waiting area behind. No people.
11. **collection-library**: A school library returns desk holding a neat stack of exercise books and a pencil case, each with a FindBox QR sticker, bookshelves softly blurred behind. No people.
12. **collection-sports**: A school sports office shelf with folded PE shirts and a tracksuit top (collar tags visible), a football and a water bottle with QR stickers, the playing field visible through an open door. No people.
13. **ready-to-go-home**: A canvas tote on a counter labelled with a small card reading only "READY", holding a water bottle with a QR sticker and a folded sweater with its collar tag visible. Warm, reassuring light.
14. **role-admin**: A tidy administrator's desk: an open laptop showing a blurred, unreadable dashboard in green tones, a sheet of FindBox stickers and a coffee cup. No people.
15. **role-staff**: Organised shelves in a school storeroom with clearly labelled items sorted by type: bottles and lunchboxes with QR stickers, folded uniforms with collar tags. No people.
16. **role-parent**: A family kitchen counter in the morning: a packed school bag, a lunchbox and bottle with FindBox QR stickers, a folded sweater with its collar tag, and a phone face-down. No people.
17. **catalog-bottle**: Studio product shot of a water bottle with a FindBox QR sticker on a sage-green seamless background, soft shadow.
18. **catalog-lunchbox**: Studio product shot of a lunchbox with a FindBox QR sticker on a warm cream seamless background.
19. **catalog-book**: Studio product shot of two exercise books and a pencil, the top book wearing a FindBox QR sticker, on a soft lilac-grey background.
20. **catalog-sweater**: Studio product shot of a folded forest-green school sweater with the collar opened to show the FindBox fabric tag, on a warm peach background.

## Images being retired

These show people that look AI-generated, show no tag, or show the wrong tag type:

- People: `editorial/reunion`, `editorial/collection`, `editorial/staff`, `editorial/admin`, `editorial/guardian`, `editorial/connect`, `editorial/home-parent`, `editorial/home-teacher`, `collection/reception`, `collection/library`, `collection/sports`, `journey/phone-scan-v2`, `journey/student-report-v2`, `classroom.jpg`, `avatars/findbox-explorer`.
- No tag: `catalog/bottle`, `catalog/book`, `catalog/lunchbox`, `catalog/clothing`, `editorial/auth-signup`, `editorial/school-hero`, `books.jpg`.
- Wrong tag type: `editorial/journey-hero` and `editorial/auth-signin` (keyring fob on a bag), `editorial/home-teaser` (blank sticker, hands), `objects/airtag` (an electronic tracker).
