import Link from "next/link"

/**
 * The footer, with the wordmark set enormous and cropped by the bottom of the
 * page.
 *
 * A landing page that has just spent a full screen on a dark closing CTA should
 * not end on a 40px row of grey links. The oversized mark gives the scroll a
 * floor to land on, and clipping it is the point — a word you can only half see
 * reads as the edge of something larger, which is a cheaper way to end a page
 * than inventing more content to put there.
 *
 * It is `aria-hidden` and duplicated by the real wordmark above it, so it is
 * decoration, not a second heading for a screen reader to trip over.
 */
export function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden border-t border-border bg-secondary/40">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 pt-10 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/mark.png" alt="" className="size-6 object-contain" />
          <span className="font-heading font-semibold text-foreground">ClinicFlow</span>
        </div>
        <nav className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
          >
            Terms
          </Link>
          <Link
            href="/login"
            className="underline decoration-transparent underline-offset-4 transition-colors hover:text-foreground hover:decoration-current"
          >
            Sign in
          </Link>
        </nav>
        <p>© 2026 ClinicFlow</p>
      </div>

      {/* Sized in `vw` so the crop is the same shape on every screen — at a
          fixed rem size it would be a whole word on a desktop and two letters
          on a phone. `-mb-[…]` is what pushes it off the bottom edge; the
          footer's `overflow-hidden` does the cutting. */}
      <p
        aria-hidden
        className="pointer-events-none mt-8 -mb-[2.2vw] px-4 text-center font-heading text-[15vw] leading-[0.78] font-extrabold tracking-[-0.055em] text-foreground/[0.06] select-none"
      >
        ClinicFlow
      </p>
    </footer>
  )
}
