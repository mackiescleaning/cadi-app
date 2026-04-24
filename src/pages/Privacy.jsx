import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-base font-black text-white mb-3">{title}</h2>
    <div className="space-y-3 text-sm text-[rgba(153,197,255,0.6)] leading-relaxed">{children}</div>
  </section>
);

export default function Privacy() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <div className="mb-10">
          <Link to="/login" className="text-xs text-[rgba(153,197,255,0.4)] hover:text-white transition-colors mb-6 inline-block">← Back to Cadi</Link>
          <h1 className="text-2xl font-black text-white mb-2">Privacy Policy</h1>
          <p className="text-xs text-[rgba(153,197,255,0.4)]">Last updated: 24 April 2026</p>
        </div>

        <Section title="Who we are">
          <p>Cadi is a software service operated by Cadi Software Ltd (company number 17174156) ("we", "us", "our"). Our registered address is available on request. You can contact us at <a href="mailto:support@cadi.cleaning" className="text-white hover:underline">support@cadi.cleaning</a>.</p>
          <p>We are the data controller for the personal data you provide when using Cadi.</p>
        </Section>

        <Section title="What data we collect">
          <p>We collect and process the following categories of personal data:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Account information — your name, email address, and password (hashed)</li>
            <li>Business information — your business name, address, and trading details</li>
            <li>Financial data — income, expenses, invoices, and payment records you enter</li>
            <li>HMRC data — your National Insurance Number (NINO), HMRC OAuth access and refresh tokens, and data returned by HMRC APIs including obligations and tax calculations</li>
            <li>Payment information — billing details processed via Stripe (we do not store card numbers)</li>
            <li>Usage data — pages visited, features used, and browser/device information for fraud prevention headers required by HMRC</li>
          </ul>
        </Section>

        <Section title="How we use your data">
          <p>We use your personal data to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Provide and maintain the Cadi service</li>
            <li>Submit Making Tax Digital (MTD) ITSA data to HMRC on your behalf, where you have authorised us to do so</li>
            <li>Process subscription payments via Stripe</li>
            <li>Send service-related emails (account, billing, important updates)</li>
            <li>Meet HMRC's fraud prevention requirements for MTD-connected software</li>
            <li>Improve the service and fix issues</li>
          </ul>
          <p>Our lawful basis is <strong className="text-white">contract performance</strong> (providing the service you signed up for) and, where required, <strong className="text-white">legal obligation</strong> (HMRC fraud prevention requirements).</p>
        </Section>

        <Section title="HMRC connection">
          <p>When you connect your HMRC account, we store OAuth tokens (access token and refresh token) in our secure database. These tokens are used solely to submit and retrieve data from HMRC on your behalf. We never share them with third parties.</p>
          <p>Your NINO is stored encrypted and used only for HMRC API calls. You can disconnect your HMRC account at any time from Settings, which revokes tokens and removes them from our database.</p>
        </Section>

        <Section title="Data sharing">
          <p>We share your data only with:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">Supabase</strong> — our database and authentication provider (data stored in EU)</li>
            <li><strong className="text-white">Stripe</strong> — payment processing (subject to Stripe's own privacy policy)</li>
            <li><strong className="text-white">HMRC</strong> — when you authorise us to submit data via MTD APIs</li>
          </ul>
          <p>We do not sell your data to third parties.</p>
        </Section>

        <Section title="Data retention">
          <p>We retain your data for as long as your account is active. If you delete your account, we will remove your personal data within 30 days, except where we are required to retain it for legal or tax compliance purposes.</p>
        </Section>

        <Section title="Your rights">
          <p>Under UK GDPR you have the right to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data ("right to be forgotten")</li>
            <li>Object to or restrict processing</li>
            <li>Data portability</li>
            <li>Lodge a complaint with the ICO (ico.org.uk)</li>
          </ul>
          <p>To exercise any of these rights, contact us at <a href="mailto:support@cadi.cleaning" className="text-white hover:underline">support@cadi.cleaning</a>.</p>
        </Section>

        <Section title="Cookies">
          <p>Cadi uses only essential cookies required for authentication and session management. We do not use advertising or tracking cookies.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy from time to time. We will notify you by email of any material changes. Continued use of Cadi after changes constitutes acceptance of the updated policy.</p>
        </Section>

        <div className="pt-4 border-t border-[rgba(153,197,255,0.08)]">
          <p className="text-xs text-[rgba(153,197,255,0.3)]">
            Questions? Email <a href="mailto:support@cadi.cleaning" className="text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">support@cadi.cleaning</a>
            {' · '}
            <Link to="/terms" className="text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">Terms & Conditions</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
