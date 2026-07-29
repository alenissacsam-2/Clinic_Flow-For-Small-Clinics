import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRxData } from "@/lib/pdf/rx-data"
import { renderRxToBuffer } from "@/lib/pdf/generate"
import { contentDisposition, filenameStem } from "@/lib/http"

export const runtime = "nodejs"

/**
 * Renders a prescription PDF on demand. RLS via the doctor's session scopes
 * access to their own clinic's prescriptions. `?download=1` forces a download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const data = await getRxData(supabase, id)
  if (!data) return new NextResponse("Not found", { status: 404 })

  const buffer = await renderRxToBuffer(data)
  const download = request.nextUrl.searchParams.get("download") === "1"
  // The patient's name goes through `contentDisposition`, not into a template
  // literal: header values are byte strings, so a Devanagari or Tamil name
  // would throw before the PDF was ever sent. See src/lib/http.ts.
  const filename = `prescription-${filenameStem(data.patient.name, "patient")}.pdf`

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(download ? "attachment" : "inline", filename),
      "Cache-Control": "private, no-store",
    },
  })
}
