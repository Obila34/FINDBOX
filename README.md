# FindBox

FindBox connects a tag store, an installable school app, and a school collection workspace through one consistent visual identity.

## Frontend review release

This GitHub release runs entirely in the browser. The VPS backend remains local for a later deployment. Accounts, orders, payment journeys, tag activation and collection stages use sample data. No real payments, shipping, authentication or email are performed. Data stays in this browser and can be reset by clearing site storage.

| Experience | Route |
| --- | --- |
| Main landing page | `/` |
| Store landing and catalog | `/shop`, `/shop/catalog` |
| Cart and checkout | `/shop/cart`, `/shop/checkout` |
| Orders and supplied tags | `/shop/account` |
| App sign in / sign up | `/app/sign-in`, `/app/sign-up` |
| Original family app | `/app/home` |
| School workspace | `/manage` |

## Sign in

Open `/app/sign-in`, choose a role, then select its sample account button. No password is needed for those buttons.

| Role | Sample account | Email |
| --- | --- | --- |
| Parent | Amina Wekesa | amina@family.demo |
| Student | Zuri Wekesa | zuri@student.demo |
| Teacher | Daniel Kimani | daniel.kimani@riverside.demo |
| School admin | Grace Njoroge | grace.njoroge@riverside.demo |

The sample email/password form accepts `FindBox2026!` for these accounts unless a local password has been set. Sign-up creates a browser-local preview account, not a server account.

## Review the connected journey

Choose a pack, add it to the bag and continue to checkout. Sign in as Parent / Amina. Choose a simulated M-Pesa or card journey and acknowledge the sample order notice. The order page previews preparation and collection stages. In My tags, connect a supplied tag to a belonging and open it in the original app. No photo upload is required.

## Development and deployment

Requires Node 22 or newer.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Deploy the static `dist` directory. The existing GitHub connection deploys main to Vercel; `vercel.json` handles direct route navigation. There are no backend environment variables or secrets required for this preview.

`npm run test:commerce` runs the full browser journey against localhost:5173 using installed Microsoft Edge. Set `BASE` to test another deployment. The PWA opens at sign-in and supports installing from a supported browser over HTTPS. The store and app retain separate navigation.

Before accepting real customers, connect and deploy the VPS API, database, server authentication, payment provider, email, backups and physical tag fulfilment. The static preview is not a live commerce service.
