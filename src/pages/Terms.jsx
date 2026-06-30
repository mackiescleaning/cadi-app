import { Link } from 'react-router-dom';

const Section = ({ title, children }) => (
  <section className="mb-8">
    <h2 className="text-base font-black text-white mb-3">{title}</h2>
    <div className="space-y-3 text-sm text-[rgba(153,197,255,0.6)] leading-relaxed">{children}</div>
  </section>
);

export default function Terms() {
  return (
    <div className="min-h-screen bg-[#080c14] text-white">
      <div className="max-w-2xl mx-auto px-6 py-16">

        <div className="mb-10">
          <Link to="/login" className="text-xs text-[rgba(153,197,255,0.4)] hover:text-white transition-colors mb-6 inline-block">← Back to Cadi</Link>
          <h1 className="text-2xl font-black text-white mb-2">Terms &amp; Conditions</h1>
          <p className="text-xs text-[rgba(153,197,255,0.4)]">Version 1.2 — 6 June 2026</p>
        </div>

        <Section title="About Cadi">
          <p>Cadi is a business management and Making Tax Digital (MTD) software service operated by Cadi Software Ltd (company number 17174156). These terms govern your use of Cadi. By creating an account you agree to them.</p>
          <p>Contact us at <a href="mailto:support@cadi.cleaning" className="text-white hover:underline">support@cadi.cleaning</a> with any questions.</p>
        </Section>

        <Section title="The service">
          <p>Cadi provides tools for cleaning businesses including job scheduling, invoicing, expense tracking, and Making Tax Digital ITSA (Income Tax Self Assessment) submissions to HMRC.</p>
          <p>We connect to HMRC's MTD APIs on your behalf when you authorise us to do so. You remain responsible for the accuracy of all data submitted to HMRC. Cadi is software, not a tax adviser — if you are unsure about your tax position, consult a qualified accountant.</p>
        </Section>

        <Section title="Your account">
          <p>You must be at least 18 years old and provide accurate information when creating an account. You are responsible for keeping your login credentials secure and for all activity under your account.</p>
          <p>One account is permitted per business. You may not share your account with third parties.</p>
        </Section>

        <Section title="Subscription and payment">
          <p>Cadi is available on the following plans:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong className="text-white">Free (Lite)</strong> — no charge. Includes scheduling, invoicing, and up to 50 customers.</li>
            <li><strong className="text-white">Pro — £39/month</strong>. Includes everything in Free plus unlimited customers, money tracker, P&amp;L, tax reserve, HMRC MTD submissions, invoice chasing, GoCardless direct debit, staff management (up to 5 crew), Front Desk AI agent, and unlimited review requests.</li>
          </ul>
          <p>Payment is taken on the same date each month via Stripe. All prices are inclusive of VAT where applicable.</p>
          <p>You may cancel at any time from Settings. Cancellation takes effect at the end of the current billing period — no refunds are issued for partial months.</p>
          <p>We reserve the right to change pricing with 30 days' notice. Continued use after a price change constitutes acceptance.</p>
        </Section>

        <Section title="HMRC MTD integration">
          <p>By connecting your HMRC account through Cadi, you authorise us to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Retrieve your business details and obligations from HMRC</li>
            <li>Submit quarterly income and expense updates on your behalf</li>
            <li>Trigger tax calculations and retrieve the results</li>
            <li>Submit the Final Declaration to complete your tax year</li>
          </ul>
          <p>You can revoke this authorisation at any time from Settings. You are responsible for reviewing all data before submission and for ensuring your records are accurate and complete.</p>
          <p>Cadi complies with HMRC's fraud prevention header requirements on all API calls.</p>
        </Section>

        <Section title="Open banking">
          <p>If you choose to connect a bank account, you authorise Cadi (via our open banking partner <strong className="text-white">Yapily Connect Ltd</strong>, FCA FRN 827001) to read your transaction history, balances, and account details on a <strong className="text-white">read-only</strong> basis.</p>
          <p>Cadi Software Ltd is registered with the FCA as an <strong className="text-white">agent of Yapily Connect Ltd</strong> under their AISP permission. Yapily is the FCA-regulated party; Cadi acts on your behalf under Yapily's permission.</p>
          <p>We will never have your bank login credentials. We cannot move money, make payments, or initiate transactions. Consent is valid for up to 90 days under PSD2 rules, after which we will prompt you to re-authorise. You may revoke consent at any time through either your bank's app, Cadi Settings → Banking, or by contacting Yapily directly.</p>
          <p>Bank transaction data is used to categorise expenses, match incoming payments to invoices, and prepare MTD submissions. You are responsible for reviewing transactions before they are submitted as part of any tax return.</p>
        </Section>

        <Section title="Direct debit collection (GoCardless)">
          <p>If you enable direct debit collection from your customers, payments are processed by <strong className="text-white">GoCardless</strong> (FCA FRN 597190). Your customers contract directly with GoCardless for the payment service. Cadi facilitates set-up and reconciliation but is not the payment processor.</p>
          <p>You are responsible for: ensuring you have your customers' explicit authorisation to collect by direct debit, providing accurate descriptions of the goods and services charged for, and handling any disputes or refunds in line with the Direct Debit Guarantee.</p>
        </Section>

        <Section title="AI-generated content">
          <p>Some Cadi features use artificial intelligence to generate text, suggestions, or summaries (including the onboarding assistant, service builder, money insights, and weekly reports). AI output can be incorrect, incomplete, or out of date.</p>
          <p>You are responsible for reviewing AI-generated content before relying on it — particularly for anything submitted to HMRC, sent to a customer, or used as a financial record. Cadi is not a substitute for professional tax, legal, or accounting advice.</p>
          <p>See our <Link to="/privacy" className="text-white hover:underline">Privacy Policy</Link> for details on which AI sub-processor handles your input.</p>
        </Section>

        <Section title="Your customers' and staff's data">
          <p>When you add customers or staff to Cadi, you are the <strong className="text-white">data controller</strong> for their personal data and Cadi is your <strong className="text-white">data processor</strong>. This means:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>You must have a lawful basis under UK GDPR for collecting and using their data</li>
            <li>You are responsible for issuing your own privacy notice to them</li>
            <li>You must handle their data subject requests (access, deletion, etc.) — Cadi will assist when asked</li>
            <li>Cadi will process their data only on your documented instructions, in line with our Data Processing Agreement (available on request)</li>
          </ul>
        </Section>

        <Section title="Acceptable use">
          <p>You must not use Cadi to submit false or misleading information to HMRC, engage in fraud, violate any applicable law, or attempt to access other users' data.</p>
          <p>We may suspend or terminate accounts that breach these terms without notice.</p>
        </Section>

        <Section title="Data and privacy">
          <p>Our <Link to="/privacy" className="text-white hover:underline">Privacy Policy</Link> explains how we collect and use your data. By using Cadi you agree to that policy.</p>
        </Section>

        <Section title="Availability and changes">
          <p>We aim to keep Cadi available at all times but cannot guarantee uninterrupted access. We may update, modify, or discontinue features with reasonable notice.</p>
          <p>We will give at least 30 days' notice before discontinuing the service entirely, during which time you can export your data.</p>
        </Section>

        <Section title="Limitation of liability">
          <p>To the fullest extent permitted by law, Cadi and Cadi Software Ltd (company number 17174156) are not liable for any indirect, incidental, or consequential loss arising from your use of the service, including penalties or interest charged by HMRC as a result of late or inaccurate submissions.</p>
          <p>Our total liability to you in any 12-month period is limited to the subscription fees you paid in that period.</p>
        </Section>

        <Section title="Governing law">
          <p>These terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
        </Section>

        <Section title="Changes to these terms">
          <p>We may update these terms from time to time. We will notify you by email of material changes. Continued use of Cadi after changes constitutes acceptance.</p>
        </Section>

        <div className="pt-4 border-t border-[rgba(153,197,255,0.08)]">
          <p className="text-xs text-[rgba(153,197,255,0.3)]">
            Questions? Email <a href="mailto:support@cadi.cleaning" className="text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">support@cadi.cleaning</a>
            {' · '}
            <Link to="/privacy" className="text-[rgba(153,197,255,0.5)] hover:text-white transition-colors">Privacy Policy</Link>
          </p>
        </div>

      </div>
    </div>
  );
}
