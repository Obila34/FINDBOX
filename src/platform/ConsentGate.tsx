import { useState } from 'react'
import { api } from './api'

/**
 * Parents who joined before FindBox had Terms are asked to agree the next time they open the app.
 * Nothing else can be done until they agree or sign out; the agreement is recorded with its version.
 */
export function ConsentGate({ onAgreed, onLogout }: { onAgreed: () => void; onLogout: () => void }) {
  const [ok, setOk] = useState(false), [busy, setBusy] = useState(false)
  async function agree() {
    setBusy(true)
    try { await api('/account/consent', { agree: true }); onAgreed() } catch { /* toast shown */ } finally { setBusy(false) }
  }
  return <div className="fb-consent" role="dialog" aria-modal="true" aria-labelledby="fb-consent-title">
    <section>
      <h2 id="fb-consent-title">One thing before you continue</h2>
      <p>FindBox now has Terms of use and an updated Privacy notice. They explain how your children's information is used to return lost belongings, who can see it, and your rights.</p>
      <label><input type="checkbox" name="consent" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>I am a parent or guardian aged 18 or over. I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and have read the <a href="/privacy" target="_blank" rel="noreferrer">Privacy notice</a>, including how FindBox handles my children's information.</span></label>
      <div className="fb-consent-actions">
        <button type="button" onClick={onLogout} disabled={busy}>Sign out</button>
        <button type="button" className="is-main" disabled={!ok || busy} onClick={() => void agree()}>Agree and continue</button>
      </div>
    </section>
  </div>
}
