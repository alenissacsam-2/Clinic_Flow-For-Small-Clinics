/**
 * Patient-facing translations.
 *
 * ── Scope, stated plainly ────────────────────────────────────────────
 * This covers the **patient-facing** surfaces only — the booking page, the
 * intake form, the payment page and the waiting-room board. The clinical app
 * a doctor uses all day stays in English, deliberately: half-translating a
 * prescribing interface is worse than not translating it, because a clinician
 * ends up guessing which half they are reading.
 *
 * Languages here are hand-written, not machine-translated, and the set is
 * small on purpose. Adding one means adding a column below, not a code change.
 * `template_lang` in the clinic's settings already chooses the WhatsApp
 * template language, so the same setting drives these pages — a patient gets
 * one language from a clinic, not two.
 *
 * Missing keys fall back to English rather than rendering a raw key, so a
 * half-finished translation degrades into a readable page.
 */

export const LOCALES = ["en", "hi", "mr", "ta"] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  mr: "मराठी",
  ta: "தமிழ்",
}

export function isLocale(value: string | null | undefined): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value)
}

/** Normalise whatever is stored in clinic settings into a supported locale. */
export function resolveLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : "en"
}

type Dict = Record<string, string>

const en: Dict = {
  // Booking
  "book.title": "Book an appointment",
  "book.pickDay": "Pick a day",
  "book.pickTime": "Pick a time",
  "book.today": "Today",
  "book.tomorrow": "Tomorrow",
  "book.noSlots": "No slots available on this day.",
  "book.yourDetails": "Your details",
  "book.name": "Full name",
  "book.phone": "Mobile number",
  "book.reason": "Reason for visit (optional)",
  "book.confirm": "Confirm booking",
  "book.booked": "Your appointment is booked",
  "book.token": "Token",
  "book.accepting": "Accepting online bookings",
  "book.nextAvailable": "Next available",
  "book.consent":
    "I agree to receive appointment updates on WhatsApp.",
  // OTP
  "otp.title": "Verify your number",
  "otp.sent": "We sent a code to your mobile number.",
  "otp.code": "Enter the code",
  "otp.verify": "Verify",
  "otp.resend": "Send again",
  // Intake
  "intake.title": "Before your visit",
  "intake.complaints": "What brings you in?",
  "intake.duration": "How long has this been going on?",
  "intake.medications": "Medicines you are currently taking",
  "intake.allergies": "Any allergies?",
  "intake.submit": "Send to the clinic",
  "intake.thanks": "Thank you — the doctor will see this before your visit.",
  // Payment
  "pay.title": "Pay your bill",
  "pay.amountDue": "Amount due",
  "pay.scan": "Scan this QR with any UPI app",
  "pay.paid": "I have paid",
  "pay.utr": "UPI reference number (optional)",
  "pay.thanks": "Thank you. The clinic will confirm shortly.",
  // Display board
  "display.inConsult": "Now in consultation",
  "display.nextInLine": "Next in line",
  "display.pleaseWait": "Please wait",
  "display.noneWaiting": "No one waiting",
  "display.waiting": "waiting",
  "display.seenToday": "seen today",
  "display.updated": "Updated",
  "display.reconnecting": "Reconnecting…",
  "display.estWait": "Estimated wait",
  "display.minutes": "min",
  "display.aboutMinutes": "about {n} min",
  "display.underAMinute": "any moment now",
  "display.calledInOrder": "Tokens are called in order. Please watch this screen.",
  "display.perPatient": "about {n} min per patient",
}

const hi: Dict = {
  "book.title": "अपॉइंटमेंट बुक करें",
  "book.pickDay": "दिन चुनें",
  "book.pickTime": "समय चुनें",
  "book.today": "आज",
  "book.tomorrow": "कल",
  "book.noSlots": "इस दिन कोई समय उपलब्ध नहीं है।",
  "book.yourDetails": "आपकी जानकारी",
  "book.name": "पूरा नाम",
  "book.phone": "मोबाइल नंबर",
  "book.reason": "आने का कारण (वैकल्पिक)",
  "book.confirm": "बुकिंग पक्की करें",
  "book.booked": "आपका अपॉइंटमेंट बुक हो गया है",
  "book.token": "टोकन",
  "book.accepting": "ऑनलाइन बुकिंग चालू है",
  "book.nextAvailable": "अगला उपलब्ध",
  "book.consent": "मैं व्हाट्सएप पर अपॉइंटमेंट की जानकारी पाने के लिए सहमत हूँ।",
  "otp.title": "अपना नंबर सत्यापित करें",
  "otp.sent": "हमने आपके मोबाइल नंबर पर एक कोड भेजा है।",
  "otp.code": "कोड दर्ज करें",
  "otp.verify": "सत्यापित करें",
  "otp.resend": "दोबारा भेजें",
  "intake.title": "आपकी विज़िट से पहले",
  "intake.complaints": "आप किस कारण से आ रहे हैं?",
  "intake.duration": "यह कब से हो रहा है?",
  "intake.medications": "अभी कौन सी दवाइयाँ ले रहे हैं",
  "intake.allergies": "कोई एलर्जी है?",
  "intake.submit": "क्लिनिक को भेजें",
  "intake.thanks": "धन्यवाद — डॉक्टर आपकी विज़िट से पहले यह देख लेंगे।",
  "pay.title": "अपना बिल चुकाएँ",
  "pay.amountDue": "देय राशि",
  "pay.scan": "किसी भी UPI ऐप से यह QR स्कैन करें",
  "pay.paid": "मैंने भुगतान कर दिया है",
  "pay.utr": "UPI संदर्भ संख्या (वैकल्पिक)",
  "pay.thanks": "धन्यवाद। क्लिनिक जल्द ही पुष्टि करेगा।",
  "display.inConsult": "अभी परामर्श में",
  "display.nextInLine": "अगला नंबर",
  "display.pleaseWait": "कृपया प्रतीक्षा करें",
  "display.noneWaiting": "कोई प्रतीक्षा में नहीं",
  "display.waiting": "प्रतीक्षा में",
  "display.seenToday": "आज देखे गए",
  "display.updated": "अपडेट",
  "display.reconnecting": "फिर से जुड़ रहे हैं…",
  "display.estWait": "अनुमानित प्रतीक्षा",
  "display.minutes": "मिनट",
  "display.aboutMinutes": "लगभग {n} मिनट",
  "display.underAMinute": "किसी भी क्षण",
  "display.calledInOrder": "टोकन क्रम से बुलाए जाते हैं। कृपया इस स्क्रीन पर ध्यान दें।",
  "display.perPatient": "प्रति मरीज़ लगभग {n} मिनट",
}

const mr: Dict = {
  "book.title": "अपॉइंटमेंट बुक करा",
  "book.pickDay": "दिवस निवडा",
  "book.pickTime": "वेळ निवडा",
  "book.today": "आज",
  "book.tomorrow": "उद्या",
  "book.noSlots": "या दिवशी कोणतीही वेळ उपलब्ध नाही.",
  "book.yourDetails": "तुमची माहिती",
  "book.name": "पूर्ण नाव",
  "book.phone": "मोबाइल क्रमांक",
  "book.confirm": "बुकिंग निश्चित करा",
  "book.booked": "तुमची अपॉइंटमेंट बुक झाली आहे",
  "book.token": "टोकन",
  "display.inConsult": "सध्या तपासणीत",
  "display.nextInLine": "पुढील क्रमांक",
  "display.pleaseWait": "कृपया प्रतीक्षा करा",
  "display.noneWaiting": "कोणीही प्रतीक्षेत नाही",
  "display.waiting": "प्रतीक्षेत",
  "display.seenToday": "आज तपासले",
  "display.updated": "अद्ययावत",
  "display.estWait": "अंदाजे प्रतीक्षा",
  "display.minutes": "मिनिटे",
  "display.aboutMinutes": "सुमारे {n} मिनिटे",
  "display.underAMinute": "कोणत्याही क्षणी",
  "display.calledInOrder": "टोकन क्रमाने पुकारले जातात. कृपया या स्क्रीनकडे लक्ष द्या.",
  "display.perPatient": "प्रति रुग्ण सुमारे {n} मिनिटे",
}

const ta: Dict = {
  "book.title": "சந்திப்பை பதிவு செய்யுங்கள்",
  "book.pickDay": "நாளைத் தேர்ந்தெடுக்கவும்",
  "book.pickTime": "நேரத்தைத் தேர்ந்தெடுக்கவும்",
  "book.today": "இன்று",
  "book.tomorrow": "நாளை",
  "book.noSlots": "இந்த நாளில் நேரம் இல்லை.",
  "book.yourDetails": "உங்கள் விவரங்கள்",
  "book.name": "முழு பெயர்",
  "book.phone": "கைபேசி எண்",
  "book.confirm": "பதிவை உறுதிப்படுத்து",
  "book.booked": "உங்கள் சந்திப்பு பதிவு செய்யப்பட்டது",
  "book.token": "டோக்கன்",
  "display.inConsult": "இப்போது ஆலோசனையில்",
  "display.nextInLine": "அடுத்தவர்",
  "display.pleaseWait": "காத்திருக்கவும்",
  "display.noneWaiting": "யாரும் காத்திருக்கவில்லை",
  "display.waiting": "காத்திருக்கிறார்கள்",
  "display.seenToday": "இன்று பார்க்கப்பட்டவர்கள்",
  "display.updated": "புதுப்பிக்கப்பட்டது",
  "display.estWait": "தோராயமான காத்திருப்பு",
  "display.minutes": "நிமிடம்",
  "display.aboutMinutes": "சுமார் {n} நிமிடம்",
  "display.underAMinute": "எந்த நேரமும்",
  "display.calledInOrder": "டோக்கன்கள் வரிசைப்படி அழைக்கப்படும். இந்தத் திரையைக் கவனிக்கவும்.",
  "display.perPatient": "ஒரு நோயாளிக்கு சுமார் {n} நிமிடம்",
}

const DICTIONARIES: Record<Locale, Dict> = { en, hi, mr, ta }

export type Translate = (key: string, vars?: Record<string, string | number>) => string

/**
 * Build a translator for one locale.
 *
 * Falls back to English, then to the key itself. The English fallback is the
 * important one: a partially translated language should read as a mixed page,
 * never as `book.confirm` on a button a patient has to press.
 *
 * `{name}` placeholders are substituted when the caller passes `vars`. They
 * exist so a sentence with a number in it stays *one* string per language —
 * "about 25 min" and "सुमारे २५ मिनिटे" put the number in different places,
 * and concatenating a translated prefix with a number can only ever produce
 * one of those word orders.
 */
export function translator(locale: Locale): Translate {
  const dict = DICTIONARIES[locale] ?? en
  return (key, vars) => {
    const raw = dict[key] ?? en[key] ?? key
    if (!vars) return raw
    return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in vars ? String(vars[name]) : match,
    )
  }
}

/** Every key English defines — used by the coverage test. */
export function englishKeys(): string[] {
  return Object.keys(en)
}

export function dictionaryFor(locale: Locale): Dict {
  return DICTIONARIES[locale] ?? en
}
