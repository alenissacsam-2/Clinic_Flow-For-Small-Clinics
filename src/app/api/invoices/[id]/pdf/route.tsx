import { NextResponse, type NextRequest } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { createClient } from "@/lib/supabase/server"
import { ReceiptDocument, type ReceiptData } from "@/lib/pdf/receipt-document"
import { logoUrlFromPath } from "@/lib/clinic"
import { formatISTDate } from "@/lib/format"
import { contentDisposition } from "@/lib/http"

export const runtime = "nodejs"

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

  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, invoice_no, total_amount, created_at, clinic:clinics(name, address, phone, doctor_name, logo_path), patient:patients(full_name, phone)")
    .eq("id", id)
    .maybeSingle()
  if (!invoice) return new NextResponse("Not found", { status: 404 })

  const [{ data: items }, { data: payments }] = await Promise.all([
    supabase.from("invoice_items").select("description, qty, unit_price").eq("invoice_id", id),
    supabase.from("payments").select("mode, amount").eq("invoice_id", id),
  ])

  const clinic = invoice.clinic as unknown as {
    name: string
    address: string | null
    phone: string | null
    doctor_name: string
    logo_path: string | null
  }
  const patient = invoice.patient as unknown as { full_name: string; phone: string } | null

  const paid = (payments ?? []).reduce((sm, p) => sm + Number(p.amount), 0)
  const data: ReceiptData = {
    clinic: {
      name: clinic.name,
      address: clinic.address,
      phone: clinic.phone,
      doctorName: clinic.doctor_name,
      logoUrl: logoUrlFromPath(clinic.logo_path),
    },
    patient: { name: patient?.full_name ?? "—", phone: patient?.phone },
    invoiceNo: invoice.invoice_no,
    dateLabel: formatISTDate(invoice.created_at),
    items: (items ?? []).map((i) => ({
      description: i.description,
      qty: i.qty,
      unit_price: Number(i.unit_price),
    })),
    total: Number(invoice.total_amount),
    paid,
    payments: (payments ?? []).map((p) => ({ mode: p.mode, amount: Number(p.amount) })),
  }

  const buffer = await renderToBuffer(<ReceiptDocument data={data} />)
  const download = request.nextUrl.searchParams.get("download") === "1"
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": contentDisposition(
        download ? "attachment" : "inline",
        `${invoice.invoice_no}.pdf`,
      ),
      "Cache-Control": "private, no-store",
    },
  })
}
