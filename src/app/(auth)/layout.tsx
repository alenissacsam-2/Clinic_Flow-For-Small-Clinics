import Link from "next/link"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link href="/" className="mb-6 flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/mark.png" alt="" className="h-9 w-9 object-contain" />
        <span className="font-heading text-xl font-semibold tracking-tight">ClinicFlow</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
      <p className="mt-6 max-w-sm text-center text-xs text-muted-foreground">
        For solo doctors in India. Appointments, prescriptions & billing with
        WhatsApp reminders built in.
      </p>
    </div>
  )
}
