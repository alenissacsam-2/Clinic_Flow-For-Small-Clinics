import { signOut } from "@/actions/auth"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Paused", robots: { index: false } }

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/mark.png" alt="" className="h-12 w-12 object-contain" />
      <h1 className="font-heading text-xl font-semibold">Your clinic is paused</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Access to this clinic has been temporarily paused. If you think this is a mistake, please
        contact ClinicFlow support.
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">Sign out</Button>
      </form>
    </div>
  )
}
