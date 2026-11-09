// Thin client for a self-hosted Ollama server. No data leaves the VPS.
// Structured calls pass a JSON schema in `format`, so the model can only answer with valid shapes.

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
  const r = await post(cfg, '/api/chat', { model, messages, stream: false, format: schema, keep_alive: '24h', options: { temperature: 0, num_ctx: 4096, num_predict: 400 } }, signal, 90000)
  const data = await r.json()
  return JSON.parse(data.message?.content || '{}')
}

/** Streams plain text, calling onToken for each piece. Resolves with the full text. */
export async function stream(cfg, messages, onToken, { signal } = {}) {
  const { model } = llmConfig(cfg)
  const r = await post(cfg, '/api/chat', { model, messages, stream: true, keep_alive: '24h', options: { temperature: 0.3, num_ctx: 4096, num_predict: 700 } }, signal, 180000)
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
  return full
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
  try { await post(cfg, '/api/generate', { model, prompt: '', keep_alive: '24h' }, undefined, 300000) } catch { /* best effort */ }
}
