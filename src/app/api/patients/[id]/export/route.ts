import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { contentDisposition, filenameStem } from "@/lib/http"

export const runtime = "nodejs"

/** DPDP data-portability: export a patient's full record as JSON. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return new NextResponse("Unauthorized", { status: 401 })

  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).maybeSingle()
  if (!patient) return new NextResponse("Not found", { status: 404 })

  const [visits, prescriptions, invoices, messages] = await Promise.all([
    supabase.from("visits").select("*").eq("patient_id", id),
    supabase.from("prescriptions").select("*, prescription_items(*)").eq("patient_id", id),
    supabase.from("invoices").select("*, invoice_items(*)").eq("patient_id", id),
    supabase.from("wa_messages").select("*").eq("patient_id", id),
  ])

  // Payments carry no patient_id — they hang off an invoice. Scoping them by
  // clinic would put every other patient's payment history into a document
  // this patient is entitled to receive, so scope by their own invoices. No
  // invoices means no payments, and `.in()` on an empty list is not a query
  // we want to send.
  const invoiceIds = (invoices.data ?? []).map((i) => i.id)
  const payments = invoiceIds.length
    ? await supabase.from("payments").select("*").in("invoice_id", invoiceIds)
    : { data: [] }

  const bundle = {
    exported_at: new Date().toISOString(),
    patient,
    visits: visits.data ?? [],
    prescriptions: prescriptions.data ?? [],
    invoices: invoices.data ?? [],
    payments: payments.data ?? [],
    whatsapp_messages: messages.data ?? [],
  }

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json",
      // Named after the patient, not their uuid — this file is handed to the
      // person it is about, under DPDP, and a uuid means nothing to them.
      "Content-Disposition": contentDisposition(
        "attachment",
        `${filenameStem(patient.full_name, "patient")}-record.json`,
      ),
      "Cache-Control": "private, no-store",
    },
  })
}
