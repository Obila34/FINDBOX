import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, PackageCheck, ScanLine, ShieldCheck, Smartphone, Tag, Users } from 'lucide-react'
import { MarketHeader } from '@/components/layout/MarketHeader'
import { HeroExperience, PremiumFinder } from '@/components/scene/HeroExperience'
import { AppShowcase } from '@/components/scene/AppShowcase'
import { UltraQualityShowcaseGrid } from '@/components/ui/ultra-quality-showcase-grid'
import FooterBlock from '@/components/ui/footer-3'
import { LandingMotion, ScrollReveal } from '@/components/ui/landing-motion'
import { LandingAuthGate } from '@/components/ui/landing-auth-gate'
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
 return <LandingAuthGate><LandingMotion><div className="fb-landing fb-production-landing" id="top"><a href="#main" className="fb-skip">Skip to content</a><section className="fb-studio-hero fb-new-hero"><MarketHeader /><HeroExperience /></section>
 <main id="main"><ScrollReveal direction="none"><div className="fb-community-strip"><span><ShieldCheck size={16} /> School-verified returns</span><span><Users size={16} /> One connected community</span><span><Smartphone size={16} /> Made for your everyday</span></div></ScrollReveal>
 <ScrollReveal><section className="fb-findbox-story fb-container" id="how"><div className="fb-findbox-story-lead"><p className="fb-kicker">WHAT FINDBOX IS</p><h2>A connected return system for the things school life leaves behind.</h2><p>FindBox brings physical labels, a shared app and school collection points into one clear process. Families connect belongings privately. Finders scan a tag or hand an item to the school. Authorised staff verify the match and help it return safely.</p><div><Link className="fb-black-link" to="/shop/catalog">Choose your labels <ArrowUpRight size={17}/></Link><Link className="fb-story-refer" to="/refer">Refer your school <ArrowUpRight size={16}/></Link></div></div><div className="fb-findbox-story-flow"><article><span><Tag size={20}/></span><small>01</small><h3>Label</h3><p>Choose QR, NFC, fabric or finder tags made for the belonging.</p></article><article><span><ScanLine size={20}/></span><small>02</small><h3>Connect</h3><p>Activate the supplied tag in your private FindBox account.</p></article><article><span><PackageCheck size={20}/></span><small>03</small><h3>Return</h3><p>A finder or school helps the item reach its verified owner.</p></article></div></section></ScrollReveal>
 <ScrollReveal><PremiumFinder /></ScrollReveal><ScrollReveal><UltraQualityShowcaseGrid /></ScrollReveal>
 <ScrollReveal><section id="workspaces" className="fb-community-section fb-container"><div className="fb-section-heading"><div><p className="fb-kicker">02 / ONE APP. EVERYONE INCLUDED.</p><h2>A place for<br /><em>your people.</em></h2></div><p>One familiar experience.<br />The right tools for your part of the school day.</p></div><div className="fb-community-cards">{[
 { role: 'Students', title: 'Your world. A little more yours.', image: '/media/avatars/findbox-explorer-1280.webp', text: 'Your belongings, daily streaks, and small acts that make a difference.', cls: 'student' },
 { role: 'Parents', title: 'Less worry. More peace of mind.', image: '/media/objects/bottle-1280.webp', text: 'See your children’s belongings, follow updates, and arrange collection.', cls: 'parent' },
 { role: 'Teachers', title: 'A little order. A big difference.', image: '/media/classroom.jpg', text: 'Scan tags, check matches, and record every safe handover.', cls: 'teacher' },
 ].map(c => <Link to="/app/sign-in" key={c.role} className={'fb-community-card ' + c.cls}><div className="fb-community-card-top"><span>{c.role}</span><ArrowUpRight size={18} /></div><img src={c.image} alt={c.role === 'Teachers' ? 'A connected school classroom' : ''} loading="lazy" /><div className="fb-community-card-copy"><h3>{c.title}</h3><p>{c.text}</p></div></Link>)}</div></section></ScrollReveal>
 <ScrollReveal><AppShowcase onInstall={handleInstall} installed={installed} /></ScrollReveal>{installInfo && <p className="fb-install-feedback" role="status">{installInfo}</p>}
 <ScrollReveal><section className="fb-faq fb-container" id="questions"><div><p className="fb-kicker">A LITTLE CLARITY</p><h2>Good questions.<br /><em>Simple answers.</em></h2><Link className="fb-black-link" to="/app/sign-in">Find your way in <ArrowUpRight size={17} /></Link></div><div>{questions.map(([q, a]) => <details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section></ScrollReveal>
 </main><ScrollReveal direction="none"><FooterBlock onInstall={handleInstall} /></ScrollReveal></div></LandingMotion></LandingAuthGate>
}
