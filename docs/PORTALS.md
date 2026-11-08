# Sign-in portals and their own addresses

FindBox has three portals. Each has its own sign-in page, session cookie and session length, and the API only accepts a portal's own session.

| Portal | Who | Address today | Dedicated address | Session |
|---|---|---|---|---|
| Family | Parents, guardians, students | `findbox.africa/app/sign-in` | stays on `findbox.africa` | 30 days, renewed while used (90 days max) |
| School | Teachers, school administrators | `findbox.africa/school/sign-in` | `school.findbox.africa` | 12 hours |
| Operations | Company admin, developer | `findbox.africa/company` | `ops.findbox.africa` (separate build) | 8 hours |

## Switching on the dedicated addresses

Nothing changes until all three steps are done, so the current site keeps working in the meantime.

1. **DNS.** Add `A` records for `ops.findbox.africa` and `school.findbox.africa` pointing to `212.47.70.252`. Wait until `nslookup ops.findbox.africa` returns that address.
2. **Server `.env`** in `/opt/findbox` (keep the file private):
   ```sh
   OPS_SITE_ADDRESS=ops.findbox.africa
   SCHOOL_SITE_ADDRESS=school.findbox.africa
   OPS_ORIGIN=https://ops.findbox.africa
   SCHOOL_ORIGIN=https://school.findbox.africa
   # Optional: only these networks may open ops (space-separated CIDRs).
   # OPS_ALLOWED_IPS=203.0.113.7/32 2001:db8::/48
   ```
3. **Deploy** (push to `main`, or rerun the deploy). Caddy obtains HTTPS certificates for the new names automatically.

After that:

- `ops.findbox.africa` serves a build that contains only the company and developer workspace. The public build no longer includes it, and `findbox.africa/company` forwards to the ops address.
- School addresses on `findbox.africa` (`/school/sign-in`, `/manage`, `/app/school-admin`, school invitations) forward to `school.findbox.africa`. Visiting `school.findbox.africa` opens the school sign-in.
- Cookies are tied to each address, so a family session can never reach operations.
- School administrator and teacher invitation emails link to the school address.

To undo, remove the five variables and deploy again.

## Devices, passkeys and two-step login

- **Trust this device:** offered on the two-step code screen for family and school accounts (never operations). It skips the code for 30 days on that browser; the password is still required.
- **New-device alert:** an email is queued whenever a correct password is used on a new kind of device.
- **Passkeys:** family and school users can add one under Security & devices and then choose "Sign in with a passkey". Operations accounts keep password + email code.
- **Security & devices** lists every signed-in device with its own Sign out, trusted devices with Forget, and passkeys with Remove.
