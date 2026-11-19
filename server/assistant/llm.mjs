// Thin client for a self-hosted Ollama server. No data leaves the VPS.
// Structured calls pass a JSON schema in `format`, so the model can only answer with valid shapes.

import os from 'node:os'
import { createHash } from 'node:crypto'

// ----- sharing one server with the site -----
// The model runs on the same machine as the website and the database, so it must never crowd them out:
//  - one generation at a time; a few questions wait briefly, the rest are answered from rules;
//  - when the machine is already busy, the model is skipped altogether;
//  - an identical question over identical data is answered from a short-lived cache.
const THREADS = Number(process.env.ASSISTANT_THREADS || 4)
const MAX_WAITING = Number(process.env.ASSISTANT_MAX_WAITING || 3), MAX_WAIT_MS = Number(process.env.ASSISTANT_MAX_WAIT_MS || 20000)
const gate = { active: 0, waiting: [] }
export class Busy extends Error { constructor(message = 'The assistant model is busy') { super(message); this.busy = true } }
export function serverBusy() {
  const max = Number(process.env.ASSISTANT_MAX_LOAD || 0) || os.cpus().length * 1.5
  return os.loadavg()[0] > max
}
async function turn(signal) {
  if (serverBusy()) throw new Busy('The server is busy')
  if (gate.active < 1) { gate.active++; return }
  if (gate.waiting.length >= MAX_WAITING) throw new Busy()
  await new Promise((resolve, reject) => {
    const w = { resolve }
    const leave = (error) => { const i = gate.waiting.indexOf(w); if (i < 0) return; gate.waiting.splice(i, 1); clearTimeout(w.timer); reject(error) }
    w.timer = setTimeout(() => leave(new Busy()), MAX_WAIT_MS)
    signal?.addEventListener('abort', () => leave(Object.assign(new Error('Stopped'), { name: 'AbortError' })), { once: true })
    gate.waiting.push(w)
  })
}
function release() { const next = gate.waiting.shift(); if (next) { clearTimeout(next.timer); next.resolve() } else gate.active = Math.max(0, gate.active - 1) }
export const modelLoad = () => ({ active: gate.active, waiting: gate.waiting.length, busy: serverBusy() })

const cache = new Map(), CACHE_MS = 10 * 60000
const keyOf = (model, kind, messages, schema) => createHash('sha256').update(JSON.stringify([model, kind, messages, schema || null])).digest('hex')
const recall = (key) => { const hit = cache.get(key); if (hit && hit.at > Date.now() - CACHE_MS) return hit.value; cache.delete(key); return undefined }
const remember = (key, value) => { cache.set(key, { at: Date.now(), value }); if (cache.size > 300) cache.delete(cache.keys().next().value) }

export function llmConfig(cfg) {
  return { url: (cfg.ollamaUrl || '').replace(/\/$/, ''), model: cfg.assistantModel || 'gemma4:e2b-it-qat' }
}

async function post(cfg, path, body, signal, timeout = 120000) {
  const { url } = llmConfig(cfg)
  if (!url) throw Object.assign(new Error('Assistant model is not configured'), { offline: true })
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), timeout)
  signal?.addEventListener('abort', () => ctl.abort(), { once: true })
  try {
    const r = await fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: ctl.signal })
    if (!r.ok) throw Object.assign(new Error('Model server returned ' + r.status), { offline: r.status >= 500 })
    return r
  } catch (e) {
    if (e.name === 'AbortError' && signal?.aborted) throw e
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { offline: true })
  } finally { clearTimeout(t) }
}

/** One structured answer, constrained to `schema`. Returns the parsed object. */
export async function structured(cfg, messages, schema, { signal } = {}) {
  const { model } = llmConfig(cfg)
  const key = keyOf(model, 'structured', messages, schema), hit = recall(key)
  if (hit !== undefined) return hit
  await turn(signal)
  try {
    const r = await post(cfg, '/api/chat', { model, messages, stream: false, think: false, format: schema, keep_alive: '24h', options: { temperature: 0, num_ctx: 4096, num_thread: THREADS, num_predict: 120 } }, signal, 60000)
    const data = await r.json()
    const value = JSON.parse(data.message?.content || '{}')
    remember(key, value)
    return value
  } finally { release() }
}

/** Streams plain text, calling onToken for each piece. Resolves with the full text. */
export async function stream(cfg, messages, onToken, { signal } = {}) {
  const { model } = llmConfig(cfg)
  const key = keyOf(model, 'stream', messages), hit = recall(key)
  if (hit !== undefined) { if (hit) onToken(hit); return hit }
  await turn(signal)
  try {
    const r = await post(cfg, '/api/chat', { model, messages, stream: true, think: false, keep_alive: '24h', options: { temperature: 0.3, num_ctx: 4096, num_thread: THREADS, num_predict: 200 } }, signal, 90000)
    const reader = r.body.getReader(), dec = new TextDecoder()
    let buf = '', full = ''
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      let nl
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim(); buf = buf.slice(nl + 1)
        if (!line) continue
        const piece = JSON.parse(line).message?.content || ''
        if (piece) { full += piece; onToken(piece) }
      }
    }
    remember(key, full)
    return full
  } finally { release() }
}

/** Is the model server reachable, and is the model downloaded? */
export async function status(cfg) {
  const { url, model } = llmConfig(cfg)
  if (!url) return { online: false, ready: false, model }
  try {
    const r = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(3000) })
    const tags = (await r.json()).models || []
    return { online: true, ready: tags.some(m => m.name === model || m.model === model), model }
  } catch { return { online: false, ready: false, model } }
}

/** Downloads the model in the background if it is missing (first start after deploy). */
export async function ensureModel(cfg, log = () => {}) {
  const s = await status(cfg)
  if (!s.online || s.ready) return s
  log('Downloading assistant model ' + s.model)
  try { await post(cfg, '/api/pull', { model: s.model, stream: false }, undefined, 3600000); log('Assistant model ready') } catch (e) { log('Assistant model download failed: ' + e.message) }
  return status(cfg)
}

/** Loads the model into memory so the first question is not slow. */
export async function warm(cfg) {
  const { model } = llmConfig(cfg)
  try { await post(cfg, '/api/generate', { model, prompt: '', keep_alive: '24h', options: { num_ctx: 4096, num_thread: THREADS } }, undefined, 300000) } catch { /* best effort */ }
}
