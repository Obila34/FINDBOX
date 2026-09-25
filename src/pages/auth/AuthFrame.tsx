import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { StudioBrand } from '@/components/brand/StudioBrand'
import { StudioBackdrop } from '@/components/scene/StudioBackdrop'
import { cx } from '@/lib/util'

export function AuthFrame({ children, title, lede, back, tone = 'family', width = 'sm' }: { children: ReactNode; title: string; lede?: string; back?: { to: string; label: string }; tone?: 'family' | 'school'; width?: 'sm' | 'md' }) {
  return <div className="fb-auth-page">
    <header className="fb-site-header"><div className="fb-pill-nav"><StudioBrand /><Link className="fb-auth-demo-link" to="/app/sign-in">Open FindBox <span aria-hidden="true">↗</span></Link></div></header>
    <main className="fb-auth-main fb-container">
      <section className="fb-auth-story">
        <StudioBackdrop animated={false} />
        <div className="fb-auth-story-copy"><p><span className="fb-brand-dot" /> {tone === 'school' ? 'For a more connected school' : 'For the things that matter'}</p><h2>A little less lost.<br />A lot more found.</h2><span><ShieldCheck size={17} /> Every return, verified by your school.</span></div>
        <span className="fb-auth-story-index">FINDBOX — A WAY BACK HOME</span>
      </section>
      <section className={cx('fb-auth-form fb-enter', width === 'md' && 'fb-auth-form-wide')}>
        <p className="fb-auth-kicker">{tone === 'school' ? 'School workspace' : 'Your FindBox'}</p>
        {back && <Link to={back.to} className="mb-5 inline-flex items-center gap-2 text-[13px] text-ink-3 hover:text-ink"><ArrowLeft size={14} />{back.label}</Link>}
        <h1 className="fb-display text-[clamp(2rem,3vw,2.8rem)] leading-[1.08]">{title}</h1>
        {lede && <p className="mt-4 text-[15px] leading-relaxed text-ink-3">{lede}</p>}
        <div className="mt-8">{children}</div>
        <p className="mt-8 border-t border-line pt-5 text-[11px] text-ink-3">Your school. Your belongings. One connected community.</p>
      </section>
    </main>
  </div>
}
export function DemoAccountNote({ className }: { className?: string }) {
  return <p className={className} />
}
