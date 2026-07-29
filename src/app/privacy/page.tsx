export const metadata = { title: "Privacy Policy — ClinicFlow" }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed">
      <h1 className="mb-2 text-2xl font-semibold">Privacy Policy</h1>
      <p className="mb-6 text-muted-foreground">Last updated: 23 July 2026</p>

      <Section title="Who we are">
        ClinicFlow provides clinic management software to independent doctors in India. Each clinic
        is the data fiduciary for its patients&apos; personal data; ClinicFlow acts as a data
        processor on the clinic&apos;s behalf under the Digital Personal Data Protection Act, 2023.
      </Section>

      <Section title="What we collect">
        On behalf of your clinic we store the information you provide: patient name, mobile number,
        age, gender, address, and clinical details (vitals, diagnoses, prescriptions, billing). We
        record whether the patient has consented to WhatsApp communication and when.
      </Section>

      <Section title="How we use it">
        Data is used solely to run the clinic: managing appointments, recording visits, generating
        prescriptions and invoices, and sending appointment-related messages over WhatsApp when the
        patient has opted in. We do not sell personal data or use it for advertising.
      </Section>

      <Section title="WhatsApp messages">
        Business-initiated WhatsApp messages are sent only to patients who have opted in and use
        pre-approved utility templates. Patients can opt out at any time by replying STOP.
      </Section>

      <Section title="Data location & security">
        Patient data is stored in encrypted databases with per-clinic access controls so one clinic
        can never see another&apos;s data. Access requires authentication.
      </Section>

      <Section title="Your rights">
        Patients may request access to, correction of, or deletion of their data by contacting their
        clinic. Deleted records are removed from active use immediately and permanently purged within
        30 days.
      </Section>

      <Section title="Contact">
        For privacy questions, contact your clinic directly, or the ClinicFlow team at the address
        provided in your service agreement.
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="mb-2 text-base font-semibold">{title}</h2>
      <p className="text-muted-foreground">{children}</p>
    </div>
  )
}
