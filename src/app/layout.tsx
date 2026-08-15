import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { env } from "@/lib/env";

// Variable fonts — omitting `weight` gives the full range.
// Jakarta carries both UI and display: its geometric skeleton plus tight
// negative tracking at large sizes is the whole typographic voice, so the
// previous serif/sans pairing is gone rather than being restyled.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "ClinicFlow — Clinic management for solo doctors";
const DESCRIPTION =
  "Appointments, prescriptions and billing with WhatsApp reminders, built for solo doctors in India.";

export const metadata: Metadata = {
  // Required so OG/Twitter image paths resolve to absolute URLs — without it
  // links shared on WhatsApp render without a preview card.
  metadataBase: new URL(env.appUrl),
  title: { default: TITLE, template: "%s · ClinicFlow" },
  description: DESCRIPTION,
  applicationName: "ClinicFlow",
  openGraph: {
    type: "website",
    siteName: "ClinicFlow",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // `suppressHydrationWarning` is mandatory, not defensive: next-themes puts
    // a blocking inline script in <head> that writes the theme class onto this
    // element before React hydrates, so the DOM legitimately differs from the
    // server payload. Without it React treats that as an error and recovers by
    // client-rendering the whole boundary — which discards the script's work
    // and produces the flash it exists to prevent.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${jakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider>
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
