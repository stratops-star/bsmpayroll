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
          <p>BSM Recruiting Notifications is an operational text message program for BSM Facility Solutions job applicants and employees. Job applicants who opt in receive messages about their application, interview scheduling and confirmations, appointment reminders, and hiring status. Employees and staff interviewers who opt in receive their daily schedule of assigned candidate interviews, schedule changes, and reminders. This program does not send marketing or promotional messages.</p>
        </Section>

        <Section title="How to join">
          <p>There are two ways to join, and both require your explicit consent.</p><p><b>Job applicants:</b> when you apply at bsmfacilitysolutions.app/careers, you may check an optional consent box agreeing to receive text messages about your application, interview scheduling, and hiring status. This box is unchecked by default. <b>Consent is optional and is not required to apply or to be considered for employment.</b></p><p><b>Employees and staff:</b> you join by completing a written internal communications authorization form during onboarding, on which you provide your mobile number and agree to receive recurring SMS about your work schedule and assigned interviews.</p><p>Only people who have opted in through one of these methods receive messages.</p>
        </Section>

        <Section title="Message frequency">
          <p>Message frequency varies. Applicants typically receive a small number of messages while their application is active, such as an interview confirmation and a reminder. Employees typically receive approximately one message per workday, plus additional messages when a schedule changes.</p>
        </Section>

        <Section title="Message and data rates">
          <p><b>Message and data rates may apply.</b> Your mobile carrier&rsquo;s standard messaging and data charges apply to messages you send and receive. BSM Facility Solutions does not charge for this program. Contact your wireless provider for details about your plan. Carriers are not liable for delayed or undelivered messages.</p>
        </Section>

        <Section title="How to get help">
          <p>Reply <b>HELP</b> to any message for assistance. You may also contact us at (929) 625-4017 or info@bsmfacilitysolutions.com.</p>
        </Section>

        <Section title="How to opt out">
          <p>Reply <b>STOP</b> to any message at any time to cancel and stop receiving messages from this program. After you reply STOP, you will receive one confirmation message and no further messages will be sent. You may also withdraw consent by contacting us at the number or email below, or, for employees, by notifying a supervisor or Human Resources. <b>Opting out does not affect your job application or your employment</b> — we will still contact you by phone or email as needed.</p>
          <p>If you opt out and later wish to resume receiving notifications, contact us using the details below, or, for employees, your supervisor or Human Resources.</p>
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
