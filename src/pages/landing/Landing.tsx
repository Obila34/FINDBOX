import { LabelJourney } from '@/commerce/LabelJourney'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ShieldCheck, Smartphone, Users } from 'lucide-react'
import { MarketHeader } from '@/components/layout/MarketHeader'
import { HeroExperience } from '@/components/scene/HeroExperience'
import { AppShowcase } from '@/components/scene/AppShowcase'
import { UltraQualityShowcaseGrid } from '@/components/ui/ultra-quality-showcase-grid'
import FooterBlock from '@/components/ui/footer-3'
import { useInstallPrompt } from '@/lib/hooks'
const questions = [
 ['How do I connect a belonging?', 'Buy a FindBox tag pack, activate each supplied tag, then give its belonging a name and category. Photos are optional. NFC tags can open the same private recovery record.'],
 ['What happens when someone finds it?', 'They scan its tag or hand it to the school office. Staff match the record, verify ownership, and arrange a safe collection.'],
 ['Can everyone use the same app?', 'Yes. Students, parents, and teachers use the same FindBox app. Your school role determines your tools and the records you can access.'],
 ['What information appears on a tag?', 'Only a unique item reference. Names, contact information, and private identifying details are not printed on the label.'],
 ['How do streaks work?', 'Review your belongings and check in once a day. Consecutive check-ins build a streak. A missed day starts a new run while your personal best remains.'],
]
export function Landing() {
 const { canPrompt, install, installed, isIOS } = useInstallPrompt(); const [installInfo, setInstallInfo] = useState('')
 async function handleInstall() { if (canPrompt) { const result = await install(); setInstallInfo(result === 'accepted' ? 'FindBox is being added to your home screen.' : 'You can install FindBox whenever you are ready.') } else setInstallInfo(installed ? 'FindBox is already installed on this device.' : isIOS ? 'In Safari, tap Share, then Add to Home Screen.' : 'Open your browser menu and choose Install app or Add to Home Screen, when available.') }
 return <div className="fb-landing fb-production-landing" id="top"><a href="#main" className="fb-skip">Skip to content</a><section className="fb-studio-hero fb-new-hero"><MarketHeader /><HeroExperience /></section>
 <main id="main"><div className="fb-community-strip"><span><ShieldCheck size={16} /> School-verified returns</span><span><Users size={16} /> One connected community</span><span><Smartphone size={16} /> Made for your everyday</span></div><LabelJourney /><UltraQualityShowcaseGrid />
 <section id="workspaces" className="fb-community-section fb-container"><div className="fb-section-heading"><div><p className="fb-kicker">02 / ONE APP. EVERYONE INCLUDED.</p><h2>A place for<br /><em>your people.</em></h2></div><p>One familiar experience.<br />The right tools for your part of the school day.</p></div><div className="fb-community-cards">{[
 { role: 'Students', title: 'Your world. A little more yours.', image: '/media/avatars/findbox-explorer-1280.webp', text: 'Your belongings, daily streaks, and small acts that make a difference.', cls: 'student' },
 { role: 'Parents', title: 'Less worry. More peace of mind.', image: '/media/objects/bottle-1280.webp', text: 'See your children’s belongings, follow updates, and arrange collection.', cls: 'parent' },
 { role: 'Teachers', title: 'A little order. A big difference.', image: '/media/classroom.jpg', text: 'Scan tags, check matches, and record every safe handover.', cls: 'teacher' },
 ].map(c => <Link to="/app/sign-in" key={c.role} className={'fb-community-card ' + c.cls}><div className="fb-community-card-top"><span>{c.role}</span><ArrowUpRight size={18} /></div><img src={c.image} alt={c.role === 'Teachers' ? 'A connected school classroom' : ''} loading="lazy" /><div className="fb-community-card-copy"><h3>{c.title}</h3><p>{c.text}</p></div></Link>)}</div></section>
 <AppShowcase onInstall={handleInstall} installed={installed} />{installInfo && <p className="fb-install-feedback" role="status">{installInfo}</p>}
 <section className="fb-faq fb-container" id="questions"><div><p className="fb-kicker">A LITTLE CLARITY</p><h2>Good questions.<br /><em>Simple answers.</em></h2><Link className="fb-black-link" to="/app/sign-in">Find your way in <ArrowUpRight size={17} /></Link></div><div>{questions.map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
 </main><FooterBlock onInstall={handleInstall} /></div>
}
