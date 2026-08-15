import { formatInTimeZone } from "date-fns-tz"

import { IST_TZ } from "@/lib/format"
import type { Lang } from "./types"

/**
 * Every word the bot says, in both languages, in one file.
 *
 * Kept out of `machine.ts` so the conversation can be read and corrected
 * without reading the state machine, and so a missing Hindi string is a type
 * error rather than an English sentence silently reaching a Hindi-speaking
 * patient. Each entry is a function of its parameters — Hindi word order is not
 * English word order, so string interpolation has to happen per language rather
 * than by substituting into a shared template.
 *
 * These are free-form session messages, not templates. They need no Meta
 * approval, which is the whole reason the bot can only ever *reply* — see the
 * note on the 24-hour window in `machine.ts`.
 */

const pick =
  <A extends unknown[]>(en: (...a: A) => string, hi: (...a: A) => string) =>
  (lang: Lang, ...a: A) =>
    (lang === "hi" ? hi : en)(...a)

/* ── Time formatting ────────────────────────────────────────────────────── */

/** "10:30 AM" */
export const timeLabel = (startUtc: string) => formatInTimeZone(startUtc, IST_TZ, "h:mm a")

/** "Tue, 16 Aug" */
export const dateLabel = (startUtc: string) => formatInTimeZone(startUtc, IST_TZ, "EEE, d MMM")

/**
 * "Today" / "Tomorrow" / the weekday, in the patient's language.
 *
 * `relativeDay` in `booking-days.ts` does this for the web widget but is
 * English-only and keyed off array position. The bot filters closed days out of
 * its list, so position is no longer meaningful here — the offset is computed
 * from the date itself.
 */
export const relativeDayLabel = pick(
  (offset: number, weekday: string) =>
    offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : weekday,
  (offset: number, weekday: string) =>
    offset === 0 ? "आज" : offset === 1 ? "कल" : weekday,
)

/* ── Openers and menus ──────────────────────────────────────────────────── */

export const greeting = pick(
  (clinic: string) => `Welcome to ${clinic}. I can book you an appointment right here.`,
  (clinic: string) => `${clinic} में आपका स्वागत है। मैं आपका अपॉइंटमेंट यहीं बुक कर सकता हूँ।`,
)

export const pickDay = pick(
  () => "Which day suits you?",
  () => "कौन सा दिन ठीक रहेगा?",
)

export const pickDayButton = pick(
  () => "Choose a day",
  () => "दिन चुनें",
)

export const pickSlot = pick(
  (day: string) => `Times available on ${day}. Which one works?`,
  (day: string) => `${day} के लिए उपलब्ध समय। कौन सा ठीक रहेगा?`,
)

export const pickSlotButton = pick(
  () => "Choose a time",
  () => "समय चुनें",
)

export const morePrompt = pick(
  () => "More times",
  () => "और समय",
)

export const backToDays = pick(
  () => "Another day",
  () => "दूसरा दिन",
)

/* ── Name ───────────────────────────────────────────────────────────────── */

export const askName = pick(
  () => "And what name should I book this under?",
  () => "और यह अपॉइंटमेंट किस नाम से बुक करूँ?",
)

export const nameTooShort = pick(
  () => "Please send the patient's full name.",
  () => "कृपया मरीज़ का पूरा नाम भेजें।",
)

/* ── Confirmation ───────────────────────────────────────────────────────── */

export const confirmPrompt = pick(
  (name: string, doctor: string, date: string, time: string) =>
    `Please check:\n\n*${name}*\n${doctor}\n${date} at ${time}\n\nShall I book it?`,
  (name: string, doctor: string, date: string, time: string) =>
    `कृपया जाँच लें:\n\n*${name}*\n${doctor}\n${date}, ${time}\n\nक्या मैं बुक कर दूँ?`,
)

export const confirmYes = pick(
  () => "Yes, book it",
  () => "हाँ, बुक करें",
)

export const confirmChange = pick(
  () => "Change time",
  () => "समय बदलें",
)

export const bookedInstant = pick(
  (date: string, time: string, token: string) =>
    `Booked. ${date} at ${time}.${token}\n\nPlease arrive a few minutes early. Reply CANCEL if you cannot make it.`,
  (date: string, time: string, token: string) =>
    `बुक हो गया। ${date}, ${time}।${token}\n\nकृपया कुछ मिनट पहले पहुँचें। न आ पाने पर CANCEL लिखें।`,
)

export const tokenSuffix = pick(
  (n: number) => ` Your token number is ${n}.`,
  (n: number) => ` आपका टोकन नंबर ${n} है।`,
)

export const bookedPending = pick(
  (date: string, time: string) =>
    `Requested: ${date} at ${time}. The clinic will confirm shortly — I will message you as soon as they do.`,
  (date: string, time: string) =>
    `अनुरोध भेज दिया: ${date}, ${time}। क्लिनिक जल्द ही पुष्टि करेगा — पुष्टि होते ही मैं आपको बता दूँगा।`,
)

export const slotTaken = pick(
  () => "Sorry — that time was just taken. Here are the times still open.",
  () => "क्षमा करें — वह समय अभी-अभी बुक हो गया। ये समय अब भी खाली हैं।",
)

export const bookFailed = pick(
  () => "Something went wrong at our end and the booking did not go through. Please try again in a moment.",
  () => "हमारी ओर से कुछ गड़बड़ हुई और बुकिंग नहीं हो पाई। कृपया थोड़ी देर में फिर कोशिश करें।",
)

/* ── Status and cancellation ────────────────────────────────────────────── */

export const statusUpcoming = pick(
  (date: string, time: string, token: string) =>
    `Your next appointment is on ${date} at ${time}.${token}`,
  (date: string, time: string, token: string) =>
    `आपका अगला अपॉइंटमेंट ${date}, ${time} को है।${token}`,
)

export const noUpcoming = pick(
  () => "You have no upcoming appointment. Reply BOOK to make one.",
  () => "आपका कोई आगामी अपॉइंटमेंट नहीं है। बुक करने के लिए BOOK लिखें।",
)

export const cancelConfirm = pick(
  (date: string, time: string) => `Cancel your appointment on ${date} at ${time}?`,
  (date: string, time: string) => `${date}, ${time} का आपका अपॉइंटमेंट रद्द कर दूँ?`,
)

export const cancelYes = pick(
  () => "Yes, cancel",
  () => "हाँ, रद्द करें",
)

export const keepIt = pick(
  () => "Keep it",
  () => "रहने दें",
)

export const cancelled = pick(
  () => "Your appointment is cancelled. Reply BOOK any time to make a new one.",
  () => "आपका अपॉइंटमेंट रद्द कर दिया गया है। नया बुक करने के लिए कभी भी BOOK लिखें।",
)

export const cancelFailed = pick(
  () => "I could not cancel that just now. Please call the clinic.",
  () => "मैं अभी इसे रद्द नहीं कर सका। कृपया क्लिनिक को कॉल करें।",
)

export const keptIt = pick(
  () => "No change — your appointment stands.",
  () => "कोई बदलाव नहीं — आपका अपॉइंटमेंट यथावत है।",
)

/* ── Opt-out ────────────────────────────────────────────────────────────── */

export const optedOut = pick(
  () => "You will not receive any more WhatsApp messages from us. Reply START to turn them back on.",
  () => "अब आपको हमारी ओर से WhatsApp संदेश नहीं मिलेंगे। दोबारा शुरू करने के लिए START लिखें।",
)

/* ── Dead ends ──────────────────────────────────────────────────────────── */

export const bookingDisabled = pick(
  (clinic: string) => `${clinic} is not taking online bookings at the moment. Please call the clinic.`,
  (clinic: string) => `${clinic} अभी ऑनलाइन बुकिंग नहीं ले रहा है। कृपया क्लिनिक को कॉल करें।`,
)

export const noSlots = pick(
  () => "There are no free slots in the next week. Please call the clinic and they will fit you in.",
  () => "अगले हफ़्ते कोई समय खाली नहीं है। कृपया क्लिनिक को कॉल करें, वे आपको समायोजित कर लेंगे।",
)

export const dayNowFull = pick(
  () => "That day just filled up. Please pick another.",
  () => "वह दिन अभी-अभी भर गया। कृपया दूसरा चुनें।",
)

export const notUnderstood = pick(
  () => "Sorry, I did not follow that. Reply BOOK to book an appointment, STATUS to see your next one, or CANCEL to cancel it.",
  () => "क्षमा करें, मैं समझ नहीं पाया। अपॉइंटमेंट बुक करने के लिए BOOK, अगला देखने के लिए STATUS, या रद्द करने के लिए CANCEL लिखें।",
)

export const unsupportedMedia = pick(
  () => "I can only read text here. Please use the buttons, or reply BOOK to start.",
  () => "मैं यहाँ केवल टेक्स्ट पढ़ सकता हूँ। कृपया बटन का उपयोग करें, या शुरू करने के लिए BOOK लिखें।",
)
