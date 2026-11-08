import {useEffect} from 'react';
import {Link,useLocation} from 'react-router-dom';
import {ArrowUpRight,Tag,ClipboardList,Bell,PackageCheck,MapPin,Monitor,Mail} from 'lucide-react';
import {MarketHeader} from '@/components/layout/MarketHeader';
import FooterBlock from '@/components/ui/footer-3';
import {LandingAuthGate} from '@/components/ui/landing-auth-gate';
import {useInstallPrompt} from '@/lib/hooks';
import './calm-home.css';
const questions=[
 ['What is FindBox?','FindBox is a digital lost-and-found management platform for schools. It brings found-item records, labels, notifications and collections into one process.'],
 ['How does a school get started?','Contact hello@findbox.africa. We help set up collection points and the school’s return process, then provision its administrator’s access.'],
 ['Do parents and students need separate accounts?','Parents use their own accounts and confirm the children linked to them by their school. A student record does not require a student login.'],
 ['What happens when an item has no label?','School staff can log it in the unclaimed-items gallery. A parent submits a claim, and staff check ownership before handing it over.'],
 ['Are personal details visible when someone scans a label?','The public return page gives hand-in instructions without displaying the owner’s private contact details. School staff confirm receipt before collection updates are sent.']
];
const steps=[
 {Icon:Tag,title:'Label',text:'Attach a label and connect the belonging to its owner’s account.'},
 {Icon:ClipboardList,title:'Record',text:'Scan the tag or log the found item and its collection point. Add a photo where useful.'},
 {Icon:Bell,title:'Notify & claim',text:'The school confirms receipt. The owner receives an update and follows the claim process.'},
 {Icon:PackageCheck,title:'Collect',text:'Staff verify ownership, hand over the item and close the record.'}
];
export function Landing(){const location=useLocation();useEffect(()=>{if(!location.hash)return;const frame=requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView({behavior:'instant'}));return()=>cancelAnimationFrame(frame)},[location.hash,location.key]);const {install,canPrompt}=useInstallPrompt();async function getApp(){if(canPrompt)await install();else window.location.assign('/app/sign-in')}
 return <LandingAuthGate><div className="fb-landing fb-production-landing fb-calm-home" id="top"><a href="#main" className="fb-skip">Skip to content</a><MarketHeader/><main id="main">
 <section className="ch-hero"><div><p className="ch-label">SCHOOL LOST & FOUND</p><h1>Every lost item finds its way back home.</h1><p className="ch-lede">A digital lost-and-found platform that helps schools record belongings, notify owners and manage safe collection.</p><div className="ch-actions"><Link to="/contact">Enquire for your school <ArrowUpRight size={17}/></Link><Link to="/shop/catalog">Shop labels <ArrowUpRight size={17}/></Link></div></div><figure><img src="/media/editorial/organised-school-box.webp" width={1536} height={1024} alt="An organised school lost-property box with neatly folded uniforms and identification labels" fetchPriority="high"/></figure></section>
 <section className="ch-about" id="about"><div><p className="ch-label">THE PROBLEM</p><h2>Lost items cost families money and schools time.</h2><p>Uniforms, bottles, books and bags can sit in storage while parents search for them or pay for replacements. Items that remain unclaimed may eventually be damaged or discarded.</p></div><div><h2>What is FindBox?</h2><p>FindBox is a digital lost-and-found management platform designed for school environments. It gives each found item a record and connects school staff, parents and students through labels, notifications and a clear collection process.</p><p>Made in Kenya. Built by parents.</p></div></section>
 <section className="ch-operations" id="how-we-do-it"><div className="ch-section-heading"><h2>How we do it</h2><p>We build on-ground operational systems for schools and provide the technology to manage them.</p></div><div className="ch-operation-grid"><article><MapPin size={25}/><h3>On-ground operations</h3><p>Collection points, organised storage, staff responsibilities and a clear process for checking and handing over belongings.</p></article><article><Monitor size={25}/><h3>A digital record</h3><p>Found-item records, QR labels, photos where needed, owner notifications and a history of verified collections.</p><Link to="/app/sign-in" data-auth-bypass>Sign in to FindBox <ArrowUpRight size={16}/></Link></article></div></section>
 <section className="ch-how" id="how-it-works"><div className="ch-section-heading"><h2>How it works</h2><p>Four steps from a labelled belonging to a recorded handover.</p></div><ol>{steps.map(({Icon,title,text},i)=><li key={title}><div><span>0{i+1}</span><Icon size={24}/></div><h3>{title}</h3><p>{text}</p></li>)}</ol></section>
 <section className="ch-faq" id="questions"><h2>Frequently asked questions</h2><div>{questions.map(([q,a])=><details key={q}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section>
 <section className="ch-contact" id="contact"><h2>Contact FindBox</h2><p>Ask about bringing FindBox to your school or get help with an existing account.</p><a href="mailto:hello@findbox.africa"><Mail size={20}/>hello@findbox.africa</a><Link to="/contact">Send an enquiry <ArrowUpRight size={16}/></Link></section>
 </main><FooterBlock onInstall={()=>void getApp()}/></div></LandingAuthGate>
}
