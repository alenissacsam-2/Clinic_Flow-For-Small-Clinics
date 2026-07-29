import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

export type ReceiptData = {
  clinic: {
    name: string
    address?: string | null
    phone?: string | null
    doctorName: string
    logoUrl?: string | null
  }
  patient: { name: string; phone?: string }
  invoiceNo: string
  dateLabel: string
  items: { description: string; qty: number; unit_price: number }[]
  total: number
  paid: number
  payments: { mode: string; amount: number }[]
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#31418C",
    paddingBottom: 8,
    marginBottom: 6,
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 40, height: 40, marginRight: 8, objectFit: "contain" },
  clinicName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#31418C" },
  title: { fontSize: 12, fontFamily: "Helvetica-Bold", marginTop: 10, marginBottom: 8 },
  muted: { color: "#555" },
  right: { textAlign: "right" },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  head: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#ddd", paddingBottom: 3 },
  cDesc: { width: "50%" },
  cQty: { width: "15%", textAlign: "right" },
  cRate: { width: "17%", textAlign: "right" },
  cAmt: { width: "18%", textAlign: "right" },
  totals: { marginTop: 10, alignSelf: "flex-end", width: "50%" },
  tRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  bold: { fontFamily: "Helvetica-Bold" },
})

export function ReceiptDocument({ data }: { data: ReceiptData }) {
  const due = Math.max(0, data.total - data.paid)
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            {/* eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf Image, not DOM */}
            {data.clinic.logoUrl ? <Image style={s.logo} src={data.clinic.logoUrl} /> : null}
            <View>
              <Text style={s.clinicName}>{data.clinic.name}</Text>
              {data.clinic.address ? <Text style={s.muted}>{data.clinic.address}</Text> : null}
              {data.clinic.phone ? <Text style={s.muted}>Ph: {data.clinic.phone}</Text> : null}
            </View>
          </View>
          <View style={s.right}>
            <Text style={s.bold}>Receipt</Text>
            <Text style={s.muted}>{data.invoiceNo}</Text>
            <Text style={s.muted}>{data.dateLabel}</Text>
          </View>
        </View>

        <Text>
          <Text style={s.bold}>Billed to: </Text>
          {data.patient.name}
          {data.patient.phone ? `  (${data.patient.phone})` : ""}
        </Text>

        <Text style={s.title}>Items</Text>
        <View style={s.head}>
          <Text style={s.cDesc}>Description</Text>
          <Text style={s.cQty}>Qty</Text>
          <Text style={s.cRate}>Rate</Text>
          <Text style={s.cAmt}>Amount</Text>
        </View>
        {data.items.map((it, i) => (
          <View style={s.row} key={i}>
            <Text style={s.cDesc}>{it.description}</Text>
            <Text style={s.cQty}>{it.qty}</Text>
            <Text style={s.cRate}>{it.unit_price.toFixed(2)}</Text>
            <Text style={s.cAmt}>{(it.qty * it.unit_price).toFixed(2)}</Text>
          </View>
        ))}

        <View style={s.totals}>
          <View style={s.tRow}>
            <Text style={s.muted}>Total</Text>
            <Text style={s.bold}>Rs. {data.total.toFixed(2)}</Text>
          </View>
          <View style={s.tRow}>
            <Text style={s.muted}>Paid</Text>
            <Text>Rs. {data.paid.toFixed(2)}</Text>
          </View>
          <View style={s.tRow}>
            <Text style={s.bold}>Due</Text>
            <Text style={s.bold}>Rs. {due.toFixed(2)}</Text>
          </View>
          {data.payments.length > 0 ? (
            <Text style={[s.muted, { marginTop: 6 }]}>
              Paid via {data.payments.map((p) => `${p.mode} (Rs. ${p.amount.toFixed(2)})`).join(", ")}
            </Text>
          ) : null}
        </View>
      </Page>
    </Document>
  )
}
