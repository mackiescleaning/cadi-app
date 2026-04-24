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
          <p className="text-xs text-[rgba(153,197,255,0.4)]">Last updated: 24 April 2026</p>
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
          <p>Cadi is available on a monthly subscription of £29 per month (inclusive of VAT where applicable). Payment is taken on the same date each month via Stripe.</p>
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
          <p>Cadi is recognised MTD-compatible software. We comply with HMRC's fraud prevention header requirements on all API calls.</p>
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
