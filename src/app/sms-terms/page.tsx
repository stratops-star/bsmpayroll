export const metadata = {
  title: 'SMS Terms and Conditions — BSM Facility Solutions',
  description: 'Terms and conditions for the BSM Recruiting SMS notification program, including message frequency, rates, HELP and STOP instructions.',
}

const UPDATED = 'July 21, 2026'

export default function SmsTermsPage() {
  return (
    <main style={{ background: '#FAF7F1', minHeight: '100vh', padding: '48px 20px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', color: '#1E1B17', lineHeight: 1.65 }}>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.22em', textTransform: 'uppercase', color: '#96723C', marginBottom: 10 }}>BSM Facility Solutions</div>
        <h1 style={{ fontSize: 32, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-.01em' }}>SMS Terms and Conditions</h1>
        <div style={{ width: 54, height: 2, background: '#96723C', margin: '14px 0 18px' }} />
        <p style={{ fontSize: 13, color: '#6b655d', margin: '0 0 32px' }}>Last updated: {UPDATED}</p>

        <Section title="Program name">
          <p><b>BSM Recruiting Notifications</b>, operated by BSM Facility Solutions.</p>
        </Section>

        <Section title="Program description">
          <p>BSM Recruiting Notifications is an internal operational text message program for BSM Facility Solutions employees and authorized staff interviewers. Messages contain work information such as your daily schedule of assigned candidate interviews, interview times, schedule changes, and reminders. This program does not send marketing or promotional messages.</p>
        </Section>

        <Section title="How to join">
          <p>This program is available only to BSM employees and authorized staff. There is no public sign-up. Employees join by completing a written internal communications authorization form during onboarding, on which they provide their mobile number and agree to receive recurring SMS notifications from BSM Facility Solutions. Only employees who have signed this authorization receive messages.</p>
        </Section>

        <Section title="Message frequency">
          <p>Message frequency varies. Recipients typically receive approximately one message per workday, and additional messages when a schedule changes.</p>
        </Section>

        <Section title="Message and data rates">
          <p><b>Message and data rates may apply.</b> Your mobile carrier&rsquo;s standard messaging and data charges apply to messages you send and receive. BSM Facility Solutions does not charge for this program. Contact your wireless provider for details about your plan. Carriers are not liable for delayed or undelivered messages.</p>
        </Section>

        <Section title="How to get help">
          <p>Reply <b>HELP</b> to any message for assistance. You may also contact us at (929) 625-4017 or info@bsmfacilitysolutions.com.</p>
        </Section>

        <Section title="How to opt out">
          <p>Reply <b>STOP</b> to any message at any time to cancel and stop receiving messages from this program. After you reply STOP, you will receive one confirmation message and no further messages will be sent. You may also withdraw consent by notifying your supervisor or Human Resources. Opting out of this program does not affect your employment.</p>
          <p>If you opt out and later wish to resume receiving notifications, contact your supervisor or Human Resources to be re-enrolled.</p>
        </Section>

        <Section title="Supported carriers">
          <p>This program is supported by major U.S. carriers including AT&amp;T, Verizon Wireless, T-Mobile, and others. Carrier support may change without notice, and carriers are not liable for delayed or undelivered messages.</p>
        </Section>

        <Section title="Privacy">
          <p>We do not sell, rent, or share mobile phone numbers or SMS consent with third parties. Mobile information collected for this program is used solely to deliver these operational messages and is never shared with third parties or affiliates for marketing or promotional purposes. See our <a href="/privacy" style={{ color: '#96723C', fontWeight: 600 }}>Privacy Policy</a>.</p>
        </Section>

        <Section title="Contact">
          <p>
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
