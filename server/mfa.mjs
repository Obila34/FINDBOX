import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { requireThat } from "./security.mjs";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes) {
  let bits = 0,
    value = 0,
    result = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function decode(s) {
  let bits = 0,
    value = 0,
    out = [];
  for (const c of s) {
    value = (value << 5) | alphabet.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function key(config) {
  const value = Buffer.from(config.encryptionKey || "", "base64");
  requireThat(value.length === 32, 503, "Security configuration is not ready");
  return value;
}
export function seal(value, config) {
  const iv = randomBytes(12),
    c = createCipheriv("aes-256-gcm", key(config), iv);
  const body = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString("base64");
}
export function unseal(value, config) {
  const b = Buffer.from(value, "base64"),
    c = createDecipheriv("aes-256-gcm", key(config), b.subarray(0, 12));
  c.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([c.update(b.subarray(28)), c.final()]).toString("utf8");
}
export function totp(secret, step = Math.floor(Date.now() / 30000)) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode(secret)).update(counter).digest(),
    o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1000000).padStart(6, "0");
}
export function validStep(secret, code, previous = -1) {
  if (!/^\d{6}$/.test(code)) return -1;
  const now = Math.floor(Date.now() / 30000);
  for (const step of [now, now - 1, now + 1])
    if (
      step > Number(previous) &&
      timingSafeEqual(Buffer.from(totp(secret, step)), Buffer.from(code))
    )
      return step;
  return -1;
}
export const newMfaSecret = () => base32(randomBytes(20));

/** Seals a school join code for later sharing; without an encryption key the code is simply not stored. */
export function sealCode(code, cfg) { try { return seal(code, cfg); } catch { return null; } }
