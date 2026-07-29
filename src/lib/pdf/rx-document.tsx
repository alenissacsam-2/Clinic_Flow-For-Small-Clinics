import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"

export type RxData = {
  clinic: {
    name: string
    address?: string | null
    phone?: string | null
    doctorName: string
    qualifications?: string | null
    registrationNo?: string | null
    specialty?: string | null
    logoUrl?: string | null
  }
  patient: {
    name: string
    ageSex?: string
    phone?: string
  }
  dateLabel: string
  vitals?: { label: string; value: string }[]
  complaints?: string | null
  diagnosis?: string | null
  advice?: string | null
  followupLabel?: string | null
  items: {
    medicine_name: string
    dosage?: string | null
    duration_days?: number | null
    instructions?: string | null
  }[]
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#111" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#31418C",
    paddingBottom: 8,
    marginBottom: 12,
  },
  headerLeft: { flexDirection: "row", alignItems: "flex-start" },
  logo: { width: 40, height: 40, marginRight: 8, objectFit: "contain" },
  clinicName: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#31418C" },
  doctorName: { fontSize: 11, fontFamily: "Helvetica-Bold" },
  muted: { color: "#555" },
  right: { textAlign: "right" },
  patientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#F1EEE7",
    padding: 8,
    borderRadius: 4,
    marginBottom: 12,
  },
  rxSymbol: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  section: { marginBottom: 10 },
  sectionTitle: { fontFamily: "Helvetica-Bold", marginBottom: 3, fontSize: 10 },
  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#ddd",
    paddingBottom: 3,
    marginBottom: 3,
  },
  row: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  cName: { width: "42%", fontFamily: "Helvetica-Bold" },
  cDose: { width: "20%" },
  cDur: { width: "18%" },
  cInstr: { width: "20%" },
  footer: {
    position: "absolute",
    bottom: 36,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  signLine: { borderTopWidth: 1, borderTopColor: "#333", width: 160, paddingTop: 4, textAlign: "center" },
  disclaimer: { fontSize: 7, color: "#888", marginTop: 4 },
})

export function RxDocument({ data }: { data: RxData }) {
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
            <Text style={s.doctorName}>{data.clinic.doctorName}</Text>
            {data.clinic.qualifications ? <Text style={s.muted}>{data.clinic.qualifications}</Text> : null}
            {data.clinic.specialty ? <Text style={s.muted}>{data.clinic.specialty}</Text> : null}
            {data.clinic.registrationNo ? (
              <Text style={s.muted}>Reg. No: {data.clinic.registrationNo}</Text>
            ) : null}
          </View>
        </View>

        <View style={s.patientRow}>
          <Text>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{data.patient.name}</Text>
            {data.patient.ageSex ? `  (${data.patient.ageSex})` : ""}
          </Text>
          <Text style={s.muted}>{data.dateLabel}</Text>
        </View>

        {data.vitals && data.vitals.length > 0 ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Vitals</Text>
            <Text style={s.muted}>
              {data.vitals.map((v) => `${v.label}: ${v.value}`).join("   |   ")}
            </Text>
          </View>
        ) : null}

        {data.complaints ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Complaints</Text>
            <Text>{data.complaints}</Text>
          </View>
        ) : null}

        {data.diagnosis ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Diagnosis</Text>
            <Text>{data.diagnosis}</Text>
          </View>
        ) : null}

        <View style={s.section}>
          <Text style={s.rxSymbol}>Rx</Text>
          {data.items.length === 0 ? (
            <Text style={s.muted}>No medicines prescribed.</Text>
          ) : (
            <>
              <View style={s.tableHead}>
                <Text style={s.cName}>Medicine</Text>
                <Text style={s.cDose}>Dosage</Text>
                <Text style={s.cDur}>Duration</Text>
                <Text style={s.cInstr}>Notes</Text>
              </View>
              {data.items.map((it, i) => (
                <View style={s.row} key={i}>
                  <Text style={s.cName}>{it.medicine_name}</Text>
                  <Text style={s.cDose}>{it.dosage ?? "—"}</Text>
                  <Text style={s.cDur}>{it.duration_days ? `${it.duration_days} days` : "—"}</Text>
                  <Text style={s.cInstr}>{it.instructions ?? "—"}</Text>
                </View>
              ))}
            </>
          )}
        </View>

        {data.advice ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Advice</Text>
            <Text>{data.advice}</Text>
          </View>
        ) : null}

        {data.followupLabel ? (
          <View style={s.section}>
            <Text style={s.sectionTitle}>Follow-up</Text>
            <Text>{data.followupLabel}</Text>
          </View>
        ) : null}

        <View style={s.footer} fixed>
          <Text style={s.disclaimer}>
            This prescription is generated digitally and is valid without a physical signature stamp.
          </Text>
          <View style={s.signLine}>
            <Text>{data.clinic.doctorName}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
