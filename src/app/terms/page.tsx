export const metadata = { title: "Terms of Service — ClinicFlow" }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-sm leading-relaxed">
      <h1 className="mb-2 text-2xl font-semibold">Terms of Service</h1>
      <p className="mb-6 text-muted-foreground">Last updated: 23 July 2026</p>

      <Section title="Service">
        ClinicFlow is software that helps solo doctors manage patients, appointments, prescriptions,
        billing and patient communication. We provide the tools; the clinical judgement, records and
        communications are the responsibility of the treating doctor.
      </Section>

      <Section title="Acceptable use">
        You agree to use ClinicFlow only for lawful clinic operations, to obtain patient consent
        before sending WhatsApp messages, and to keep prescriptions compliant with the Telemedicine
        Practice Guidelines and applicable medical regulations.
      </Section>

      <Section title="Prescriptions & medical responsibility">
        ClinicFlow generates prescription and receipt documents from the information you enter. It
        does not provide medical advice or verify clinical content. The prescribing doctor is solely
        responsible for the accuracy and legality of every prescription.
      </Section>

      <Section title="Availability">
        We aim for high availability but do not guarantee uninterrupted service. WhatsApp delivery
        depends on Meta&apos;s platform and the patient&apos;s opt-in status.
      </Section>

      <Section title="Data">
        You retain ownership of your clinic&apos;s data. Handling of personal data is described in our
        Privacy Policy.
      </Section>

      <Section title="Changes">
        We may update these terms; continued use after an update constitutes acceptance.
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
