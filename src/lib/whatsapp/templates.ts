/**
 * Template registry. Each entry mirrors an approved Meta utility template.
 * `values` are the ordered body params ({{1}}, {{2}}…). `preview` renders the
 * same text locally so the app can show a readable message log without calling
 * Meta. `hasDocument` templates attach a PDF header.
 */

export type TemplateName =
  | "appt_confirmed"
  | "appt_reminder"
  | "appt_cancelled"
  | "prescription_doc"
  | "payment_receipt"
  | "followup_due"
  | "otp_code"
  | "intake_link"
  | "payment_request"

export type Lang = "en" | "hi"

export const DOCUMENT_TEMPLATES: TemplateName[] = ["prescription_doc", "payment_receipt"]

export function hasDocument(name: TemplateName): boolean {
  return DOCUMENT_TEMPLATES.includes(name)
}

type Renderer = (v: string[]) => string

const PREVIEWS: Record<TemplateName, Record<Lang, Renderer>> = {
  appt_confirmed: {
    en: (v) => `Your appointment with ${v[0]} at ${v[1]} is confirmed for ${v[2]} at ${v[3]}. Token no: ${v[4]}.`,
    hi: (v) => `${v[1]} में ${v[0]} के साथ आपका अपॉइंटमेंट ${v[2]} को ${v[3]} बजे तय हुआ है। टोकन नं: ${v[4]}।`,
  },
  appt_reminder: {
    en: (v) => `Reminder: your appointment with ${v[0]} at ${v[1]} is on ${v[2]} at ${v[3]}. Reply CANCEL if you cannot come.`,
    hi: (v) => `याद दिलाना: ${v[1]} में ${v[0]} के साथ आपका अपॉइंटमेंट ${v[2]} को ${v[3]} बजे है। न आ पाने पर CANCEL लिखें।`,
  },
  appt_cancelled: {
    en: (v) => `Your appointment at ${v[0]} on ${v[1]} has been cancelled. Call ${v[2]} to rebook.`,
    hi: (v) => `${v[0]} में ${v[1]} का आपका अपॉइंटमेंट रद्द कर दिया गया है। दोबारा बुक करने के लिए ${v[2]} पर कॉल करें।`,
  },
  prescription_doc: {
    en: (v) => `Hello ${v[0]}, here is your prescription from ${v[1]}. Get well soon!`,
    hi: (v) => `नमस्ते ${v[0]}, ${v[1]} की ओर से आपका प्रिस्क्रिप्शन संलग्न है। जल्दी स्वस्थ हों!`,
  },
  payment_receipt: {
    en: (v) => `Hello ${v[0]}, payment of ₹${v[1]} received at ${v[2]}. Receipt attached. Thank you!`,
    hi: (v) => `नमस्ते ${v[0]}, ${v[2]} में ₹${v[1]} का भुगतान प्राप्त हुआ। रसीद संलग्न है। धन्यवाद!`,
  },
  followup_due: {
    en: (v) => `Hello ${v[0]}, ${v[1]} advised a follow-up visit around ${v[2]}. Book here: ${v[3]}`,
    hi: (v) => `नमस्ते ${v[0]}, ${v[1]} ने ${v[2]} के आसपास फॉलो-अप विज़िट की सलाह दी है। बुक करें: ${v[3]}`,
  },
  otp_code: {
    en: (v) => `${v[0]} is your verification code. It expires in 5 minutes. Do not share it with anyone.`,
    hi: (v) => `${v[0]} आपका सत्यापन कोड है। यह 5 मिनट में समाप्त हो जाएगा। इसे किसी के साथ साझा न करें।`,
  },
  intake_link: {
    en: (v) => `Hello ${v[0]}, please fill your quick pre-visit form for ${v[1]} before your appointment: ${v[2]}`,
    hi: (v) => `नमस्ते ${v[0]}, कृपया अपनी अपॉइंटमेंट से पहले ${v[1]} के लिए यह छोटा फॉर्म भरें: ${v[2]}`,
  },
  payment_request: {
    en: (v) => `Hello ${v[0]}, please pay ₹${v[1]} to ${v[2]}. Pay by UPI here: ${v[3]}`,
    hi: (v) => `नमस्ते ${v[0]}, कृपया ${v[2]} को ₹${v[1]} का भुगतान करें। UPI से यहाँ भुगतान करें: ${v[3]}`,
  },
}

export function renderPreview(name: TemplateName, lang: Lang, values: string[]): string {
  return PREVIEWS[name][lang](values)
}
