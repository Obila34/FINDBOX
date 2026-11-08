// Passkeys: sign in with the device's fingerprint, face or screen lock instead of a password.
import { z } from 'zod';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { hash, secret, id, requireThat } from './security.mjs';
import { deviceLabel } from './portals.mjs';

const CHALLENGE_COOKIE = 'findbox_webauthn';
const toB64 = (bytes) => Buffer.from(bytes).toString('base64url');
const fromB64 = (text) => new Uint8Array(Buffer.from(text, 'base64url'));

export async function passkeyRoutes(app, { pool, cfg, user, session }) {
  // One registrable domain covers findbox.africa and its ops./school. portals.
  const rpID = new URL(cfg.origin).hostname.replace(/^(www|ops|school)\./, '');
  const origins = [cfg.origin, cfg.opsOrigin, cfg.schoolOrigin].filter(Boolean);

  async function remember(reply, challenge, purpose, userId = null) {
    const token = secret();
    await pool.query("DELETE FROM webauthn_challenges WHERE expires_at<now()");
    await pool.query("INSERT INTO webauthn_challenges(token_hash,challenge,user_id,purpose,expires_at) VALUES($1,$2,$3,$4,now()+interval '5 minutes')", [hash(token), challenge, userId, purpose]);
    reply.setCookie(CHALLENGE_COOKIE, token, { path: '/api', httpOnly: true, secure: cfg.production, sameSite: 'strict', maxAge: 300 });
  }
  async function recall(req, reply, purpose) {
    const token = req.cookies[CHALLENGE_COOKIE];
    requireThat(token, 400, 'Passkey request expired. Please try again.');
    reply.clearCookie(CHALLENGE_COOKIE, { path: '/api' });
    const row = (await pool.query("DELETE FROM webauthn_challenges WHERE token_hash=$1 AND purpose=$2 AND expires_at>now() RETURNING challenge,user_id", [hash(token), purpose])).rows[0];
    requireThat(row, 400, 'Passkey request expired. Please try again.');
    return row;
  }

  app.post('/api/account/passkeys/options', async (req, reply) => {
    const u = await user(req);
    requireThat(Date.now() - new Date(u.session_created_at).getTime() < 15 * 60000, 403, 'Sign in again before adding a passkey');
    const existing = (await pool.query('SELECT id,transports FROM passkeys WHERE user_id=$1', [u.id])).rows;
    const options = await generateRegistrationOptions({
      rpName: 'FindBox', rpID, userName: u.email, userDisplayName: u.name, userID: new TextEncoder().encode(u.id),
      attestationType: 'none', excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports ? p.transports.split(',') : undefined })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    await remember(reply, options.challenge, 'register', u.id);
    return options;
  });

  app.post('/api/account/passkeys/register', async (req, reply) => {
    const u = await user(req);
    const d = z.object({ response: z.record(z.string(), z.unknown()) }).parse(req.body);
    const saved = await recall(req, reply, 'register');
    requireThat(saved.user_id === u.id, 400, 'Passkey request expired. Please try again.');
    let result;
    try { result = await verifyRegistrationResponse({ response: d.response, expectedChallenge: saved.challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: false }); }
    catch { requireThat(false, 400, 'That passkey could not be verified. Please try again.'); }
    requireThat(result.verified && result.registrationInfo, 400, 'That passkey could not be verified. Please try again.');
    const c = result.registrationInfo.credential;
    await pool.query('INSERT INTO passkeys(id,user_id,public_key,counter,transports,label) VALUES($1,$2,$3,$4,$5,$6)', [c.id, u.id, toB64(c.publicKey), c.counter, (c.transports || []).join(','), deviceLabel(String(req.headers['user-agent'] || ''))]);
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), u.id, 'passkey_added']);
    return { ok: true };
  });

  app.post('/api/account/passkeys/:id/remove', async (req) => {
    const u = await user(req);
    const r = await pool.query('DELETE FROM passkeys WHERE user_id=$1 AND left(id,16)=$2', [u.id, String(req.params.id).slice(0, 16)]);
    requireThat(r.rowCount, 404, 'That passkey was already removed');
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), u.id, 'passkey_removed']);
    return { ok: true };
  });

  app.post('/api/auth/passkey/options', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const options = await generateAuthenticationOptions({ rpID, userVerification: 'preferred' });
    await remember(reply, options.challenge, 'login');
    return options;
  });

  app.post('/api/auth/passkey/verify', { config: { rateLimit: { max: 20, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const d = z.object({ response: z.object({ id: z.string().max(1024) }).passthrough(), portal: z.enum(['family', 'school']).optional() }).parse(req.body);
    const saved = await recall(req, reply, 'login');
    const key = (await pool.query('SELECT p.*,u.disabled_at FROM passkeys p JOIN users u ON u.id=p.user_id WHERE p.id=$1', [d.response.id])).rows[0];
    requireThat(key && !key.disabled_at, 401, 'This passkey is not registered with FindBox');
    requireThat(!(await pool.query('SELECT 1 FROM company_access WHERE user_id=$1', [key.user_id])).rowCount, 403, 'This account uses the FindBox operations sign-in.');
    let result;
    try {
      result = await verifyAuthenticationResponse({ response: d.response, expectedChallenge: saved.challenge, expectedOrigin: origins, expectedRPID: rpID, requireUserVerification: false,
        credential: { id: key.id, publicKey: fromB64(key.public_key), counter: Number(key.counter), transports: key.transports ? key.transports.split(',') : undefined } });
    } catch { requireThat(false, 401, 'That passkey could not be verified'); }
    requireThat(result.verified, 401, 'That passkey could not be verified');
    await pool.query('UPDATE passkeys SET counter=$1,last_used_at=now() WHERE id=$2', [result.authenticationInfo.newCounter, key.id]);
    await pool.query('INSERT INTO audit_log(id,user_id,action) VALUES($1,$2,$3)', [id(), key.user_id, 'login_success']);
    const u = (await pool.query('SELECT * FROM users WHERE id=$1', [key.user_id])).rows[0];
    // A passkey unlocked with fingerprint, face or PIN already proves two factors.
    return session(reply, u, { req, portal: d.portal || null, mfaVerified: !!result.authenticationInfo.userVerified });
  });
}
