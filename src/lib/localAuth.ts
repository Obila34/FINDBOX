// Device-local credentials for the frontend. Server authentication is required for cross-device accounts.
const key = (email: string) => 'findbox.credentials.' + email.trim().toLowerCase()
const hex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' }, material, 256))
}
export function hasLocalCredential(email: string) { return !!localStorage.getItem(key(email)) }
export async function saveLocalCredential(email: string, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  localStorage.setItem(key(email), JSON.stringify({ salt: hex(salt.buffer), hash: await derive(password, salt) }))
}
export async function verifyLocalCredential(email: string, password: string) {
  const raw = localStorage.getItem(key(email))
  if (!raw) return false
  const saved = JSON.parse(raw) as { salt: string; hash: string }
  const salt = Uint8Array.from(saved.salt.match(/.{2}/g) ?? [], b => parseInt(b, 16))
  return await derive(password, salt) === saved.hash
}
