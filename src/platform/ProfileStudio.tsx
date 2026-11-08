import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Camera, Check, Trash2, Sparkles } from 'lucide-react'
import { ACCENTS, ICON_GROUPS, ProfileAvatar, saveProfile, squarePhoto, useProfile, type Profile } from './profile'
import { notify } from './feedback'
import { cx } from '@/lib/util'
import './profile-studio.css'

const TAGLINES = ['Always packs the night before', 'Bottle back, every day', 'Label everything', 'Lost nothing this term']

/** Personal profile editor: photo, emoji, accent ring, name and tagline, with a live preview. */
export function ProfileStudio({ role, school }: { role: string; school?: string }) {
  const saved = useProfile()
  const [draft, setDraft] = useState<Profile | null>(null)
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const still = useReducedMotion()
  useEffect(() => { if (saved && !draft) setDraft(saved) }, [saved, draft])
  if (!draft) return <section className="ps-card" role="status"><p className="text-sm text-gray-400">Loading your profile…</p></section>
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)
  const set = (patch: Partial<Profile>) => setDraft(d => (d ? { ...d, ...patch } : d))

  async function pick(f?: File) {
    if (!f) return
    try { set({ avatar: await squarePhoto(f) }) } catch (e) { notify((e as Error).message, 'error') }
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!draft || !saved) return
    setBusy(true)
    try {
      const patch: Partial<Profile> = { name: draft.name, tagline: draft.tagline, accent: draft.accent, emoji: draft.emoji }
      if (draft.avatar !== saved.avatar) patch.avatar = draft.avatar
      setDraft(await saveProfile(patch))
      notify('Profile saved', 'success')
    } catch (err) { notify((err as Error).message, 'error') } finally { setBusy(false) }
  }

  return <form className="ps-card" onSubmit={submit} style={{ ['--ps-accent' as string]: ACCENTS[draft.accent]?.[0] }}>
    <div className="ps-preview" style={{ ['--ps-accent' as string]: ACCENTS[draft.accent]?.[0] }}>
      <motion.div key={draft.avatar || draft.emoji || draft.accent} initial={still ? false : { scale: 0.85, rotate: -6, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}>
        <ProfileAvatar profile={draft} size={96} />
      </motion.div>
      <div className="min-w-0">
        <p className="ps-kicker">{role === 'student' ? 'Student' : role === 'parent' ? 'Parent' : role === 'manager' ? 'School admin' : 'Teacher'}{school ? ` · ${school}` : ''}</p>
        <h2 className="truncate">{draft.name || 'Your name'}</h2>
        <p className="ps-tagline">{draft.tagline || 'Add a short line about you'}</p>
      </div>
      <button type="button" className="ps-camera" onClick={() => file.current?.click()} aria-label="Upload a profile photo"><Camera size={17} /></button>
      <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </div>

    <div className="ps-section">
      <div className="ps-row"><h3>Picture</h3>{draft.avatar && <button type="button" className="ps-ghost" onClick={() => set({ avatar: null })}><Trash2 size={14} />Remove photo</button>}</div>
      <button type="button" className={cx('ps-initials', !draft.emoji && !draft.avatar && 'is-on')} aria-pressed={!draft.emoji && !draft.avatar} onClick={() => set({ emoji: '', avatar: null })}>Use my initials</button>
      {ICON_GROUPS.map(group => <div key={group.title} className="ps-icon-group">
        <p>{group.title}</p>
        <div className="ps-emojis" role="radiogroup" aria-label={group.title}>
          {group.icons.map(([key, label, Icon]) => { const on = draft.emoji === 'i:' + key && !draft.avatar; return <motion.button whileTap={{ scale: 0.85 }} whileHover={still ? undefined : { y: -2 }} type="button" role="radio" aria-checked={on} aria-label={label} title={label} key={key} className={cx(on && 'is-on')} onClick={() => set({ emoji: 'i:' + key, avatar: null })}>
            <Icon size={20} strokeWidth={1.6} />
          </motion.button> })}
        </div>
      </div>)}
      <button type="button" className="ps-upload" onClick={() => file.current?.click()}><Camera size={16} />Upload a photo</button>
    </div>

    <div className="ps-section">
      <h3>Accent</h3>
      <div className="ps-accents" role="radiogroup" aria-label="Accent colour">
        {Object.entries(ACCENTS).map(([key, [light, deep]]) => <button type="button" role="radio" aria-checked={draft.accent === key} aria-label={key} key={key} onClick={() => set({ accent: key })} style={{ background: `linear-gradient(135deg, ${light}, ${deep})` }}>
          <AnimatePresence>{draft.accent === key && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check size={15} /></motion.span>}</AnimatePresence>
        </button>)}
      </div>
    </div>

    <div className="ps-section ps-fields">
      <label>Display name<input value={draft.name} maxLength={100} minLength={2} required onChange={e => set({ name: e.target.value })} /></label>
      <label>Tagline<input value={draft.tagline} maxLength={80} placeholder="Something short about you" onChange={e => set({ tagline: e.target.value })} /></label>
      <div className="ps-suggest">{TAGLINES.map(t => <button type="button" key={t} onClick={() => set({ tagline: t })}><Sparkles size={12} />{t}</button>)}</div>
    </div>

    <AnimatePresence>
      {dirty && <motion.div className="ps-save" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}>
        <span>Unsaved changes</span>
        <button type="button" className="ps-ghost" onClick={() => setDraft(saved)}>Undo</button>
        <button className="fp-primary" disabled={busy}>{busy ? 'Saving…' : 'Save profile'}</button>
      </motion.div>}
    </AnimatePresence>
  </form>
}
