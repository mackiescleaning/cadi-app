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
          <p className="text-xs text-[rgba(153,197,255,0.4)]">Version 1.3 — 21 June 2026</p>
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
            <li>Bank transaction data — where you connect a bank account via open banking, we receive your transaction history, account names, and balance for the accounts you select</li>
            <li>Customer & employee data — names, contact details, and payment information for the customers and staff you add to manage your cleaning business</li>
            <li>Payment information — billing details processed via Stripe (we do not store card numbers)</li>
            <li>Usage data — pages visited, features used, and browser/device information for fraud prevention headers required by HMRC</li>
            <li>Session recordings — anonymised interaction data via FullStory (opt-in via cookie consent), excluding any field marked as sensitive</li>
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
          <p><strong className="text-white">Fraud-prevention headers and device ID.</strong> HMRC require MTD-connected software to send a small set of fraud-prevention headers with every submission. To produce these we generate a stable device identifier the first time you use Cadi on a device and keep it in your browser's local storage. The identifier is shared only with HMRC, is not used for advertising or analytics, and is removed when you clear your browser data.</p>
        </Section>

        <Section title="Open banking connection">
          <p>If you choose to connect a bank account, we use <strong className="text-white">Yapily Connect Ltd</strong>, an FCA-authorised Account Information Service Provider (AISP, FRN 827001), to retrieve transaction data on a <strong className="text-white">read-only</strong> basis. We never have your bank credentials — those are entered directly with your bank.</p>
          <p>Cadi Software Ltd is registered with the FCA as an <strong className="text-white">agent of Yapily Connect Ltd</strong> under their AISP permission. This means Yapily is the regulated party providing the open banking service; Cadi acts on your behalf under Yapily's permission. You can verify our agent status on the <a href="https://register.fca.org.uk/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">FCA Financial Services Register</a>.</p>
          <p>Your consent under PSD2 lasts up to 90 days. We send a renewal prompt approximately 14 days before expiry so you have time to re-authorise without losing access.</p>
          <p>Under Open Banking regulations:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Consent lasts up to 90 days, after which you'll be prompted to re-authorise</li>
            <li>You can revoke access at any time through either your bank's app or in Cadi Settings → Banking</li>
            <li>We cannot move money or make payments — only read transactions you authorise</li>
            <li>Cadi uses the data solely to categorise transactions, match invoices, and prepare MTD submissions</li>
          </ul>
          <p>Yapily acts as our data processor under our agreement; their privacy policy is at <a href="https://www.yapily.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">yapily.com/legal/privacy-policy</a>.</p>
        </Section>

        <Section title="Scheduler — maps, geocoding and weather">
          <p>The Scheduler displays customer locations on small route maps and uses weather forecasts to flag rain-affected jobs. To do this we send limited data to three external services:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">postcodes.io</strong> — your customers' postcodes are sent to this free UK postcode lookup service to convert them into map coordinates. No customer name or contact details are sent. Results are cached locally in your browser so each unique postcode is only sent once per device.</li>
            <li><strong className="text-white">Carto / OpenStreetMap</strong> — the map tiles themselves are served by CARTO using OpenStreetMap data. Your IP address and the map area you're viewing reach these providers (a normal consequence of loading any map).</li>
            <li><strong className="text-white">Met Office DataHub</strong> — we request weather forecasts for the postcode areas you have jobs in. Only the postcode is sent; no customer identity is attached.</li>
          </ul>
          <p>None of these services receive financial data, HMRC tokens, or anything Cadi marks as sensitive.</p>
        </Section>

        <Section title="Direct debit collection">
          <p>If you enable customer direct debit collection, we use <strong className="text-white">GoCardless</strong> (FCA FRN 597190) as the payment processor. Your customers' bank details are entered directly with GoCardless — Cadi never sees them. GoCardless is the controller for the bank details they collect; their privacy policy is at <a href="https://gocardless.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">gocardless.com/legal/privacy</a>.</p>
        </Section>

        <Section title="AI processing">
          <p>Some features (conversational onboarding, the service builder, money insights, weekly reports) use AI models provided by <strong className="text-white">Anthropic</strong>. When you use these features, the relevant content you provide is sent to Anthropic for processing.</p>
          <p>Anthropic processes this data as our data processor under their <a href="https://www.anthropic.com/legal/aup" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">commercial terms</a>, does not train on it, and retains it only for the duration needed to return a response (plus short-term abuse-monitoring caches). No bank credentials, NINO, or HMRC tokens are ever sent to Anthropic.</p>
        </Section>

        <Section title="Sub-processors">
          <p>We share data with these processors solely to provide the service:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">Supabase</strong> — database, authentication, edge functions (EU region)</li>
            <li><strong className="text-white">Vercel</strong> — application hosting and CDN</li>
            <li><strong className="text-white">Stripe</strong> — subscription billing</li>
            <li><strong className="text-white">GoCardless</strong> — customer direct debit collection (when enabled)</li>
            <li><strong className="text-white">Yapily</strong> — open banking transaction access (when enabled)</li>
            <li><strong className="text-white">HMRC</strong> — MTD ITSA and RTI submissions on your behalf</li>
            <li><strong className="text-white">Anthropic</strong> — AI features (onboarding, insights, reports)</li>
            <li><strong className="text-white">Resend</strong> — transactional email (welcome, billing, reports)</li>
            <li><strong className="text-white">FullStory</strong> — anonymised session replay (opt-in only)</li>
            <li><strong className="text-white">postcodes.io</strong> — UK postcode → coordinate lookup for Scheduler maps</li>
            <li><strong className="text-white">CARTO + OpenStreetMap</strong> — map tile rendering</li>
            <li><strong className="text-white">Met Office DataHub</strong> — weather forecasts for scheduled job dates</li>
          </ul>
          <p>We do not sell your data to third parties. We do not use it for advertising.</p>
        </Section>

        <Section title="Data retention">
          <p>We retain your data for as long as your account is active. If you delete your account from Settings, we begin erasure within 7 days and complete it within 30 days, except where retention is required by law (specifically: HMRC requires you keep tax records for 5 years and 10 months from the end of the relevant tax year — anonymised tax-relevant records may be retained for this period).</p>
          <p>Bank transaction data syncs are retained while your bank is connected and for 12 months after disconnect (to support tax return preparation), then deleted.</p>
          <p>Server logs are retained for 30 days for security and operational purposes.</p>
        </Section>

        <Section title="International transfers">
          <p>Our primary data store is hosted in the EU (Ireland). Some sub-processors (Anthropic, Stripe, FullStory, Vercel) process data in the United States. These transfers rely on the <strong className="text-white">UK International Data Transfer Addendum to the EU Standard Contractual Clauses</strong> as the safeguard.</p>
        </Section>

        <Section title="Security">
          <p>We protect your data with: TLS 1.2+ encryption in transit, AES-256 encryption at rest, row-level isolation between businesses, single-sign-on for staff access, principle-of-least-privilege for internal access, and regular dependency updates.</p>
          <p>If a personal data breach occurs that is likely to result in a risk to your rights and freedoms, we will notify the ICO within 72 hours and you without undue delay.</p>
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
          <p><strong className="text-white">For your own customers' data.</strong> If you're a business owner using Cadi and one of your customers asks you to delete or export their data, you can do this yourself from the customer's record in Cadi (Customers → open the customer → GDPR options). Erasure deletes the customer record and cascades to their rounds, recurring jobs and notes. Invoices and completed-job records are kept for HMRC's required 6-year retention but personal details on those records are redacted. A receipt of the action is written to your audit log.</p>
        </Section>

        <Section title="Audit log">
          <p>Cadi keeps an internal log of sensitive actions taken on your account — customer archives and erasures, SAR exports, job deletions, bulk round changes, and invoice payment events. This log is private to you and is provided so you can demonstrate accountability if asked by the ICO or a customer. We never use it for advertising or share it outside your account.</p>
        </Section>

        <Section title="Cookies">
          <p>Cadi uses essential cookies for authentication and session management. With your consent (via the cookie banner) we also use FullStory for anonymised session recording — this helps us debug issues and improve usability. You can change your choice at any time by clearing your cookies and reloading the app.</p>
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
