import { Link } from 'react-router-dom'
import { SiteNav } from '@/components/layout/SiteNav'
import FooterBlock from '@/components/ui/footer-3'

/**
 * Terms of use, including orders, delivery and refunds.
 * Plain-language draft: have it reviewed by a Kenyan advocate before relying on it.
 */
export function Terms() {
  return <div className="cinema-root fb-legal-page"><SiteNav /><main className="fb-legal">
    <p className="fb-legal-kicker">Terms</p>
    <h1>FindBox terms of use</h1>
    <p>These terms apply when you use FindBox as a parent or guardian, a student, a member of school staff or a school. By creating an account or placing an order you agree to them. Version 2026-11.</p>

    <h2>What FindBox does</h2>
    <p>FindBox helps schools return lost belongings. Families label belongings with a FindBox QR, schools log what is found, and FindBox tells the family where to collect it. FindBox does not guarantee that a lost item will be found or returned, and is not responsible for the condition of items held at a school.</p>

    <h2>Your account</h2>
    <p>Give accurate details, keep your password to yourself and tell us at once if someone else has used your account. Parents and guardians are responsible for the accounts of the children they add. A student login is only created by, or with the approval of, a parent, guardian or the school.</p>
    <p>You must not use FindBox to find, contact or track another person, to claim items that are not yours, or to interfere with the service. We may suspend an account that does.</p>

    <h2>Schools</h2>
    <p>A school decides who its staff are, approves the children linked to each parent, and runs its own collection points. The school is responsible for the items it holds and for handing them to the right person. Unclaimed items may be donated by the school after its holding period, which FindBox shows on each item.</p>

    <h2>Orders, delivery and refunds</h2>
    <p>Prices are in Kenya shillings and are shown before you pay. Payment is taken through our payment provider; FindBox never asks for your M-Pesa PIN and does not store card details.</p>
    <p>Labels are printed for a named child, so they are made to order. You choose pickup at your school or delivery to your home, and we tell you when the order is ready or on its way.</p>
    <p>If labels arrive damaged, wrong or not at all, tell us within 14 days at <a href="mailto:hello@findbox.africa">hello@findbox.africa</a> and we will replace them or refund you. Because labels are personalised, we cannot refund an order simply because you changed your mind once printing has started. Nothing here removes rights you have under Kenyan consumer law.</p>

    <h2>Your information</h2>
    <p>How we handle personal information, including children's information, is set out in the <Link to="/privacy">privacy notice</Link>.</p>

    <h2>Changes and ending</h2>
    <p>We may update these terms and will tell account holders before a change that affects them takes effect. You can stop using FindBox and ask for your account to be deleted at any time from Settings.</p>

    <h2>Law and contact</h2>
    <p>These terms are governed by the laws of Kenya. Questions and complaints: <a href="mailto:hello@findbox.africa">hello@findbox.africa</a>.</p>
  </main><div className="px-3 pb-3 sm:px-4 md:px-6"><FooterBlock onInstall={() => window.location.assign('/app/sign-in')} /></div></div>
}
