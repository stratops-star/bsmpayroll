export const metadata = {
  title: 'Privacy Policy — BSM Facility Solutions',
  description: 'How BSM Facility Solutions collects, uses, and protects personal information, including mobile phone numbers used for SMS notifications.',
}

const UPDATED = 'July 21, 2026'

export default function PrivacyPage() {
  return (
    <main style={{ background: '#FAF7F1', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1E1B17', lineHeight: 1.65 }}>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: '#96723C', marginBottom: 10 }}>BSM Facility Solutions</div>
        <h1 style={{ fontSize: 32, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.01em' }}>Privacy Policy</h1>
        <div style={{ width: 54, height: 2, background: '#96723C', margin: '14px 0 18px' }} />
        <p style={{ fontSize: 13, color: '#6b655d', margin: '0 0 32px' }}>Last updated: {UPDATED}</p>

        <Section title="Who we are">
          <p>BSM Facility Solutions (&ldquo;BSM,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) provides facility management and janitorial staffing services. This policy explains what personal information we collect, how we use it, and how we protect it.</p>
        </Section>

        <Section title="Information we collect">
          <p>Depending on your relationship with us, we may collect:</p>
          <ul>
            <li><b>Job applicants:</b> name, contact details including phone number and email address, work eligibility and experience information, employment preferences, and any documents you choose to submit such as a r&eacute;sum&eacute; or photograph.</li>
            <li><b>Employees and staff:</b> the information above plus employment records, work assignments, schedules, and the mobile number you provide for work communications.</li>
            <li><b>Website visitors:</b> basic technical information such as browser type and pages visited, used only to keep the site working properly and secure.</li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <ul>
            <li>To evaluate applications, schedule interviews, and manage hiring.</li>
            <li>To administer employment, assign work, and communicate about schedules and assignments.</li>
            <li>To send operational SMS notifications to employees who have authorized them (see below).</li>
            <li>To meet legal, tax, and regulatory obligations.</li>
          </ul>
        </Section>

        <Section title="SMS notifications">
          <p>BSM sends operational text messages to employees and authorized staff who have provided written consent during onboarding. These messages contain work information such as daily interview schedules, schedule changes, and reminders.</p>
          <p><b>We do not sell, rent, or share mobile phone numbers or SMS consent with any third party.</b> Mobile information collected for SMS is used solely to deliver these operational messages and is never shared with third parties or affiliates for marketing or promotional purposes.</p>
          <p>Message and data rates may apply. Message frequency varies, typically about one message per workday. Reply <b>STOP</b> at any time to stop receiving messages, or <b>HELP</b> for assistance. See our <a href="/sms-terms" style={{ color: '#96723C', fontWeight: 600 }}>SMS Terms and Conditions</a> for details.</p>
        </Section>

        <Section title="How we share information">
          <p>We do not sell your personal information. We share it only when necessary: with service providers who help us operate our business (for example, hosting, email, and SMS delivery providers) under obligations to protect it; with clients or building owners where required to staff an assignment; and when required by law or to protect our legal rights.</p>
        </Section>

        <Section title="Data retention and security">
          <p>We retain personal information for as long as needed for the purposes described above and to meet legal obligations, then dispose of it securely. We use reasonable administrative and technical safeguards, including access controls and encrypted storage, to protect personal information. No system is perfectly secure, but we work to protect your information appropriately.</p>
        </Section>

        <Section title="Your choices">
          <p>You may request access to, correction of, or deletion of the personal information we hold about you, subject to our legal and recordkeeping obligations. Employees may withdraw SMS consent at any time by replying STOP or by notifying a supervisor or Human Resources.</p>
        </Section>

        <Section title="Children">
          <p>Our services are directed to adults. We do not knowingly collect personal information from children under 16.</p>
        </Section>

        <Section title="Changes to this policy">
          <p>We may update this policy from time to time. The date at the top of this page reflects the most recent revision.</p>
        </Section>

        <Section title="Contact us">
          <p>Questions about this policy or your information:</p>
          <p style={{ margin: '10px 0 0' }}>
            BSM Facility Solutions<br />
            203 Clifton Place, Brooklyn, NY 11216<br />
            Phone: (929) 625-4017<br />
            Email: <a href="mailto:info@bsmfacilitysolutions.com" style={{ color: '#96723C', fontWeight: 600 }}>info@bsmfacilitysolutions.com</a>
          </p>
        </Section>

        <div style={{ borderTop: '1px solid #E5DFD3', marginTop: 40, paddingTop: 18, fontSize: 12, color: '#8a8378' }}>
          &copy; {new Date().getFullYear()} BSM Facility Solutions. All rights reserved.
        </div>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 30 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: '#1E1B17' }}>{title}</h2>
      <div style={{ fontSize: 15, color: '#3d3831' }}>{children}</div>
    </section>
  )
}
