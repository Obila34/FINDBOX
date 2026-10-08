import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, QrCode, Bell } from 'lucide-react'
import { ProductImage } from '@/components/ui/ProductImage'

export function AppShowcase({ onInstall, installed }: { onInstall: () => void; installed: boolean }) {
  const [tab, setTab] = useState<'belongings' | 'quest'>('belongings')
  return <section className="fb-app-showcase" id="your-app"><div className="fb-container"><div className="fb-showcase-heading"><div><p className="fb-kicker">03 / THE FINDBOX APP</p><h2>Your belongings,<br /><em>in one place.</em></h2></div><div><p>Connect tags, report a loss and follow every verified return from one account.</p><button className="fb-black-link" data-protected-destination="/app/welcome" onClick={onInstall}>{installed ? 'App installed' : 'Get the FindBox app'} <ArrowUpRight size={18} /></button></div></div>
    <div className="fb-phone-composition">
      <div className="fb-phone fb-phone-catalog"><div className="fb-phone-status">9:41 <span>● ▰</span></div><div className="fb-phone-title"><h3>Your world.</h3><Bell size={19} /></div><div className="fb-phone-tabs"><button aria-pressed={tab === 'belongings'} onClick={() => setTab('belongings')}>Belongings</button><button aria-pressed={tab === 'quest'} onClick={() => setTab('quest')}>Explorer</button></div><div className="fb-phone-object">{tab === 'belongings' ? <ProductImage kind="bottle" className="fb-showcase-product-photo" /> : <img className="fb-companion-image" src="/media/avatars/findbox-explorer-640.webp" alt="Maya, your FindBox companion" width={640} height={960} loading="lazy" />}</div><div className="fb-phone-sheet"><span className="fb-kicker">{tab === 'belongings' ? 'TAGGED & CONNECTED' : 'YOUR NEXT ADVENTURE'}</span><h4>{tab === 'belongings' ? 'The everyday bottle.' : 'Meet your companion.'}</h4><p>{tab === 'belongings' ? 'Little things. Safely connected.' : 'Small helpful acts. Lasting impact.'}</p><Link to={tab === 'belongings' ? '/app/welcome' : '/app/streaks'} className="fb-black-link">{tab === 'belongings' ? 'Open your belongings' : 'Start your streak'} <ArrowUpRight size={16} /></Link></div></div>
      <div className="fb-phone fb-phone-feature"><div className="fb-phone-status">9:41 <span>● ▰</span></div><span className="fb-kicker">RETURN UPDATES</span><h3>Follow each<br /><em>return.</em></h3><div className="fb-feature-orb"><QrCode size={70} strokeWidth={1} /></div><div className="fb-phone-notice"><span><Check size={19} /></span><div><strong>Owner verified.</strong><p>Collection is ready.</p></div></div><Link to="/app/welcome" className="fb-black-link">Open return updates <ArrowUpRight size={16} /></Link></div>
      <div className="fb-showcase-side"><span>ONE APP.<br />THE RIGHT VIEW.</span><p>Students.<br />Parents.<br /><em>Schools.</em></p><div>↙ Private access for every role</div></div>
    </div>
  </div></section>
}
