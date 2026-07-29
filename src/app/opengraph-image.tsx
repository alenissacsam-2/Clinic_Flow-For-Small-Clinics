import { ImageResponse } from "next/og"
import { brandMarkDataUri } from "@/lib/brand"

export const alt = "ClinicFlow — clinic management for solo doctors"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
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
          // Hex approximations of the "Indigo & Bone" tokens — Satori can't read
          // CSS variables, so these are the one place the palette is duplicated.
          // If --background/--primary move in globals.css, move these too.
          background: "linear-gradient(135deg, #1E1D26 0%, #26305F 100%)",
          color: "#F7F4EE",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og Satori image, not a DOM img */}
          <img
            src={mark}
            alt=""
            width={68}
            height={68}
            style={{ borderRadius: 16 }}
          />
          <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: -0.5 }}>ClinicFlow</div>
        </div>

        <div
          style={{
            marginTop: 44,
            fontSize: 66,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1.5,
            maxWidth: 940,
          }}
        >
          Run your whole clinic day without touching paper
        </div>

        <div style={{ marginTop: 30, fontSize: 30, color: "#B3BEE4", maxWidth: 900 }}>
          Online booking, WhatsApp reminders, prescriptions and billing — built for solo doctors in
          India.
        </div>
      </div>
    ),
    size,
  )
}
