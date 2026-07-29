import { ImageResponse } from "next/og"
import { getBookingContext } from "@/lib/booking-context"
import { brandMarkDataUri } from "@/lib/brand"

export const alt = "Book an appointment"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

/**
 * Per-clinic preview card. Doctors share /book/<slug> on WhatsApp, so the
 * card leads with the clinic and doctor rather than the ClinicFlow brand.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const ctx = await getBookingContext(slug)
  const clinic = ctx?.clinic

  const clinicName = clinic?.name ?? "Book an appointment"
  const doctor = clinic?.doctor_name ? `with ${clinic.doctor_name}` : ""
  const meta = [clinic?.specialty, clinic?.address].filter(Boolean).join(" · ")
  const mark = brandMarkDataUri()

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          background: "#EDE9E1",
          color: "#22201C",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 600, color: "#31418C" }}>
          Book an appointment online
        </div>

        <div
          style={{
            marginTop: 24,
            fontSize: 72,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -2,
            maxWidth: 1000,
          }}
        >
          {clinicName}
        </div>

        {doctor ? (
          <div style={{ marginTop: 20, fontSize: 40, color: "#413D36" }}>{doctor}</div>
        ) : null}

        {meta ? (
          <div style={{ marginTop: 14, fontSize: 26, color: "#6A665D", maxWidth: 960 }}>{meta}</div>
        ) : null}

        <div
          style={{
            marginTop: 56,
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontSize: 24,
            color: "#6A665D",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og Satori image, not a DOM img */}
          <img
            src={mark}
            alt=""
            width={38}
            height={38}
            style={{ borderRadius: 9 }}
          />
          Powered by ClinicFlow
        </div>
      </div>
    ),
    size,
  )
}
