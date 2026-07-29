# ClinicFlow — Competitive Gap Analysis

**Date:** 2026-07-26 · **Method:** vendor marketing sites fetched directly + app-store listings + pricing pages, cross-checked against ClinicFlow's actual codebase (schema, templates, seed data — not marketing claims).

> **Read this first — two honesty caveats.**
> 1. **Competitor claims are their marketing, not verified product.** Almost none publish technical detail. Where a claim is only on a blog or a third-party aggregator, it's labelled. Treat "they have X" as "they *say* they have X."
> 2. **ClinicFlow's side is verified from source.** Every gap below was checked against the repo (`supabase/migrations/`, `src/lib/whatsapp/templates.ts`, `src/lib/status.ts`, schema greps). Nothing here is assumed.

---

## 0. The headline

There are **three** genuinely dangerous gaps, and they're not the ones that look obvious:

| # | Gap | Why it's existential |
|---|---|---|
| **1** | **Zero healthcare-standards support** (ABDM/ABHA, FHIR, ICD-10, SNOMED, LOINC, NHCX) | This is the "protocol" question. India's digital health backbone is ABDM. Competitors are registering with HFR/HPR and issuing ABHA IDs at reception. ClinicFlow can't participate in any of it — and can't be bought by anyone who needs it. |
| **2** | **Price floor collapse** — Zospital is **free forever**, MyKlinic is **₹99/month** | Both target *exactly* ClinicFlow's segment (solo doctors). Any pricing above ~₹500/mo now needs an explicit justification story. |
| **3** | **129 medicines in the database** | Competitors claim 10,000–80,000. This is a demo dataset shipped as production. A doctor will hit its limits in the first hour. |

Everything else is a normal, closeable feature gap.

---

## 1. What ClinicFlow actually is (verified baseline)

**Tables:** clinics, clinic_members, clinic_invites, patients, appointments, availability, availability_overrides, slot_blocks, visits, prescriptions, prescription_items, medicines, invoices, invoice_items, invoice_counters, payments, wa_messages, booking_otps, intake_requests, platform_admins.

**Clinical record:** `visits.vitals` (jsonb: bp_sys, bp_dia, pulse, temp_f, weight_kg, spo2) + free-text `complaints`, `diagnosis`, `advice`, `followup_date`. No coding system, no templates, no attachments.

**WhatsApp:** 9 templates × 2 languages (en/hi) — `appt_confirmed`, `appt_reminder`, `appt_cancelled`, `prescription_doc`, `payment_receipt`, `followup_due`, `otp_code`, `intake_link`, `payment_request`. Direct **Meta Cloud API**, no BSP.

**Roles:** doctor / staff, plus a platform-operator tier. Single clinic per account.

**Medicines:** ~129 seeded rows (`0003_seed_medicines.sql`).

**Standards support:** none. `grep -ric "fhir|hl7|icd|loinc|snomed|abha|abdm|nhcx" src supabase` → **zero hits**.

---

## 2. Gap register — ranked by severity

### 🔴 TIER 1 — Strategic / hard to retrofit

#### 1.1 ABDM / ABHA — *the single biggest gap*
India's national digital health stack. Who has it:

- **Cliniqwise** — the deepest: "Full ABDM Production Milestones (M1–M3)", ABDM M1/M2/M3 **consent audits**, and a **10-second ABHA QR check-in** at reception (patient scans NHA QR, profile auto-populates). Plus **NHCX 2.0** (National Health Claims Exchange) and **HL7 FHIR R4**.
- **Sanjeevani ERP** — "ABDM compliance from day one," included in *every* tier including the ₹999/mo Starter. Does **HFR** (Health Facility Registry) + **HPR** (Health Professional Registry) registration for you, creates ABHA IDs at reception via QR scan, shares records over **FHIR R4**.
- **MocDoc** — "ABDM Compliant Software" + **NABH Advanced Certified for EMR & HMS**.
- **Healcard** — "ABDM Compliant," "NHA Approved."
- **Lifemaan** — ABHA ID linking, "ABDM-ready records."

**ClinicFlow: nothing.** Not a stub, not a flag — the concept doesn't exist in the schema.

**Why it's worse than it looks:** ABHA isn't a feature, it's an *identity layer*. Retrofitting means adding a national patient identifier, consent artefacts (M2), and FHIR-shaped record export (M3) across `patients`, `visits`, `prescriptions`. The longer the schema calcifies, the more expensive. And "ABDM compliant" is now a checkbox on procurement forms and a trust signal on landing pages — Sanjeevani puts it in the ₹999 tier precisely because it's table stakes.

#### 1.2 No clinical coding — diagnosis is a `text` column

| Product | Coding claimed |
|---|---|
| Cliniqwise | ICD-10 **and** ICD-11, SNOMED-CT auto-suggest, LOINC (labs), CPT + CDT (billing/dental) |
| MocDoc | ICD-10, ICD-9, SNOMED, LOINC, CDT, CPT |
| DocPulse | ICD-10 |
| **ClinicFlow** | **free text** |

**Consequence chain:** no coding → no insurance claim mapping → no NHCX → no analytics by condition → no research/reporting value → no interoperable record export. This is the technical root of gaps 1.1, 2.4 and 2.6 simultaneously. Fixing coding unlocks three other things.

#### 1.3 Medicine database: 129 rows
- **BOOKNMEET:** 80,000 generic/brand entries
- **Zospital:** AI recognises "10,000+ drug names and formulations"
- **DocPulse:** searchable by brand *or* composition
- **ClinSav:** ships pre-loaded drugs, procedures, diagnosis groupings, complaints
- **ClinicFlow:** 129 curated rows

A real Indian OPD prescriber needs tens of thousands of brand names. This is the fastest-to-fix Tier 1 item (it's a data problem, not an architecture problem) and probably the highest embarrassment-per-hour-of-work ratio in the whole list.

#### 1.4 No drug-interaction or allergy checking
- **Zospital:** "Drug interaction alerts, dosage suggestions"
- **DocPulse:** "real-time drug interaction & allergy alerts"
- **MocDoc:** diagnosis-linked medicine suggestions

ClinicFlow **stores** `allergies` and `chronic_conditions` on the patient and then **never checks them** when a prescription is written. That's arguably worse than not storing them — it implies a safety net that isn't there. This is a patient-safety gap, not just a feature gap.

---

### 🟠 TIER 2 — Competitive parity

#### 2.1 Pharmacy / inventory — near-universal, absent here
| Product | Depth |
|---|---|
| **Cliniqwise** | Best-in-class: batch/lot/expiry, alerts at **90/60/30 days**, **FEFO** auto-suggest at POS, **GRN** automation, vendor POs with rate contracts, credit-note returns, multi-store (main/OPD/ward), and **stock can't be deducted without a mapped bill** |
| **Zospital** | Stock alerts, prescription→dispense linking, purchase orders |
| **Sanjeevani** | FEFO lot selection, GST POS, Rx auto-populated into dispensing |
| **DocPulse** | Stock + supplier tracking, email reorder alerts, returns |
| **Healcard** | Expiry tracking + top-selling/highest-cost medicine analytics |
| **EasyClinic** | AI-assisted reorder, pilferage controls |
| **ClinicFlow** | — |

Many Indian solo doctors dispense from their own counter. This is often 30–50% of clinic revenue. Its absence isn't "missing a module" — it's being invisible to a large share of the revenue the doctor actually cares about.

#### 2.2 Labs & diagnostics
- **Cliniqwise:** LOINC-coded orders, lab report PDFs to WhatsApp
- **Sanjeevani:** pathology + radiology modules — orders auto-created from the OPD prescription, technician result-entry screen, report delivered on WhatsApp to patient *and referring doctor*
- **MocDoc:** lab results into EMR, sample-type tagging, colour-coded comparison against prior results
- **DocPulse:** lab results auto-attached to EMR, radiology reports
- **ClinicFlow:** no orders, no results, no attachments — a visit can't even hold a scanned report

**Note the sub-gap:** ClinicFlow has **no document/file upload on a visit at all**. No scan, no report, no photo. For dermatology, ortho, or anyone reviewing outside reports, that's disqualifying.

#### 2.3 Telemedicine / video consults
- **Cliniqwise:** **WebRTC**, P2P + cloud-routed, bandwidth adaptation, in-call chat + file upload, post-consult ePrescription with digital signature
- **DocPulse:** encrypted video on "HIPAA compliant cloud," prepaid/postpaid consult modes, digitally-signed Rx after the call
- **Lifemaan / BOOKNMEET:** video consults in-app
- **ClinicFlow:** none

ClinicFlow's own `/terms` page references telemedicine guidelines and the Rx PDF carries the registration number *for* telemedicine compliance — the compliance groundwork exists but the feature doesn't.

#### 2.4 Insurance / TPA
**Lifemaan is dramatically ahead here** and it's worth reading in detail — panel registration at admission (policy no., sum insured), **pre-authorisation** capture (diagnosis, treatment plan, estimated cost), final-bill packet generation (itemised bill + discharge summary + investigation reports), cashless settlement, **TPA-wise outstanding report**, and claim **resubmission** with document attachments. It documents a real split payment: TPA cashless ₹40,000 + cash ₹2,000 + UPI ₹4,000 + card ₹4,000 on one invoice.

- **Cliniqwise:** NHCX 2.0 claims gateway + CPT/CDT mapping
- **MocDoc:** Aarogyasri, Ayushman Bharat, TPA eligibility checks, claim status tracking
- **ClinicFlow:** cash/UPI only, no payer concept at all

*Fair caveat:* a pure private-pay solo GP may never need this. But it locks ClinicFlow out of any clinic touching government schemes — a large and growing segment.

#### 2.5 Payments are manually reconciled
ClinicFlow's UPI flow is deliberately manual (`Mark received` + optional UTR) because personal UPI VPAs have no status API — **that reasoning is sound and documented**. But competitors sidestep it entirely:
- **Cliniqwise:** auto-generated UPI QR at the counter with **"real-time audit reconciliation"** and an "UPI Auto-Reconciled: 20" dashboard tile
- **Zoho Bookings:** Razorpay / Stripe / PayPal
- **Lifemaan:** cash, card, UPI, NEFT, TPA — each recorded with mode/amount/timestamp/user

**The fix is known:** a Razorpay/Cashfree merchant VPA gives webhook-verified payment. ClinicFlow chose zero-integration simplicity; the market chose automation.

#### 2.6 Multi-language — ClinicFlow is English-only UI
- **Lifemaan:** Speech-to-Rx dictation in **22 major Indian languages** + English + Hinglish
- **Cufront:** AI booking in **23 Indian languages**
- **Zospital:** voice transcription in English/Hindi/Hinglish
- **MocDoc:** claims Tamil, Hindi, Arabic, Dhivehi (blog only)
- **ClinicFlow:** English UI. WhatsApp templates *are* bilingual (en/hi) — genuinely good — but the doctor-facing app is English-only.

For tier-2/3 India and for receptionists specifically, this is a real adoption barrier.

#### 2.7 No AI, anywhere
| Product | AI claim |
|---|---|
| **Zospital** | Flagship: real-time voice → **structured** prescription, auto-fills dosage/frequency/duration, 10,000+ drug names, "save 15+ min per consultation" |
| **Lifemaan** | Speech-to-Rx (22 languages) + **AI queue ordering** across doctors |
| **EasyClinic** | AI intake & triage, clinical decision support, "World's Largest AI Clinical Pilot" claim |
| **Healcard** | "SmartSuggest AI" — diagnosis/treatment suggestions |
| **MocDoc** | AI suggestions from past diagnoses |
| **Cufront** | AI booking assistant |
| **ClinicFlow** | none |

Note: **Cliniqwise and DocPulse also have zero AI** and are doing fine — so this isn't yet decisive. But Zospital's voice-to-structured-Rx is the most credible product wedge in this whole list: it attacks the single most painful minute of a solo doctor's day, and it's free.

#### 2.8 Native mobile apps
Confirmed store listings: **Lifemaan** (two apps — doctor "Heroes of Lifemaan" + patient), **DocPulse** ("DocPulse Pro", iOS + Android), **MocDoc** (iOS + Android), **Healcard** (iOS + Android, with patient/doctor/pharmacy/lab/partner portals), **ClinSav** (Android only).

Web-only, like ClinicFlow: **MyKlinic** ("no app download required" — positioned as a *feature*), **Zospital** ("works in your browser"), **Cliniqwise**, **Sanjeevani**.

**Verdict: contested, not a clear gap.** ClinicFlow could add a PWA/installable shell cheaply and neutralise it. Not urgent.

#### 2.9 No offline capability — cloud-dependent
- **ClinSav:** the extreme — **100% offline**, all data on the doctor's own device, backups to *their* Google Drive, real-time sync to staff with "priority to doctor's data" conflict resolution. One login per device. Android tablets.
- **Cliniqwise:** pragmatic middle — "local network syncs prescriptions and prints thermal invoices offline," "offline browser resilience"
- **ClinicFlow:** Supabase-backed; **internet down = clinic down**

In small-town India with patchy connectivity, this is a genuine operational risk. A service-worker + IndexedDB queue for the *consult* path (write Rx offline, sync + send WhatsApp when back) would close most of the practical risk without going full local-first.

---

### 🟡 TIER 3 — Nice-to-have / defensible to skip

| Gap | Who has it | Note |
|---|---|---|
| **Waiting-room queue display (TV/LED)** | Cliniqwise (live LED + vitals triage), Sanjeevani (digital token display), DocPulse, Lifemaan (patient position) | Cheap to build — a read-only `/display/[slug]` route. High perceived value, low effort. **Best effort/impact ratio on this list.** |
| **Multi-branch** | DocPulse (clinic-chain tier: central dashboard, unified patient DB across branches, central call centre), MocDoc ("Combo View"), EasyClinic (100+ locations), Sanjeevani (Enterprise) | Deliberately out of scope for solo. Fine to skip. |
| **IPD / beds** | Lifemaan, MocDoc, Sanjeevani, DocPulse, Cliniqwise | Out of scope. Correctly skipped. |
| **Marketing / CRM / recall** | MyKlinic (**WhatsApp campaigns**, greetings, daily summaries — gated behind paid tier), EasyClinic (birthday/refill/post-visit messages), Lifemaan (auto **vaccination reminders**), Zospital (Google Business review collection) | ClinicFlow is transactional-only. Vaccination reminders + review requests are the two highest-value additions and both reuse the existing WhatsApp queue. |
| **Specialty clinical templates** | MocDoc (15+ incl. dental/ortho **drawing tools**), Cliniqwise (15+, "1-click case templates"), Healcard (**WHO & IAP growth charts for Indian children**), Lifemaan (15+) | ClinicFlow's "specialty presets" only set fee + slot length — they don't touch the clinical form. Healcard's IAP growth charts are a lovely, specific, India-correct touch. |
| **Patient portal** | MocDoc ("Personal Health Folders"), Healcard, Sanjeevani, DocPulse app (family-member management) | ClinicFlow has token-links (intake/pay) but no persistent login for patients to re-download an old Rx. |
| **IVR phone booking** | DocPulse (24/7 automated voice booking + cancellation) | Genuinely differentiated for elderly/non-smartphone patients. |
| **Reporting depth** | MocDoc (claims 1,000+ reports), DocPulse (doctor productivity, dept performance), Cliniqwise (doctor commission tracking, margin analysis) | ClinicFlow: today/week/30-day revenue, payment modes, outstanding. Thin but arguably right-sized for solo. |
| **Handwriting/stylus input** | Lifemaan (captures pen strokes, explicitly **not** OCR), ClinSav (freehand eNotes) | Niche but beloved by doctors who refuse to type. |
| **Security certifications** | Cliniqwise (**SOC 2 Type II**, HIPAA, GDPR, DPDP, CERT-In, AES-256, 99.99% SLA, Mumbai AWS), MocDoc (NABH Advanced Certified) | ClinicFlow is DPDP-*designed* but has no audit, no cert, no published SLA, no `/security` page. Cliniqwise's cert stack is the strongest trust signal in the market. |

---

## 3. Per-competitor: what they do better

### Cliniqwise — **the most dangerous competitor overall**
₹10,000/year flat (~₹833/mo) for up to 10 beds, zero AMC, zero setup, 14-day trial, published on their own site.

Better than ClinicFlow at: ABDM M1–M3 + consent audits · ABHA QR check-in · NHCX claims · FHIR R4 · ICD-10/11 + SNOMED + LOINC + CPT/CDT · full pharmacy (FEFO/GRN/expiry tiers/multi-store) · WebRTC telemedicine · LED queue displays · UPI auto-reconciliation · billing-leakage auto-audit · SOC 2 Type II + CERT-In + Mumbai AWS · published flat pricing.

**Their protocol advantage is the real story.** They are the only vendor in this set that has actually implemented the Indian health-data stack end to end (ABDM → FHIR → NHCX). Everyone else says "ABDM compliant"; Cliniqwise names the milestones.

**Their weakness:** no native app, no AI, no language support stated, and inconsistent go-live claims ("48 hours" vs "4 weeks").

### Zospital — **the pricing threat**
**Free forever**, unlimited patients/prescriptions/appointments/invoices, no card. (Homepage narrows this to "free forever for solo practitioners"; features page doesn't — inconsistent, and there's no paid rate card at all.)

Better at: **AI voice → structured prescription** (the standout feature in this entire analysis) · drug interaction alerts · pharmacy with prescription→dispense flow · multi-role logins (doctor/receptionist/pharmacist/admin) with audit trail · Kanban ops board · Google Business review collection.

**Directly attacks ClinicFlow's positioning at ₹0.** "If you can use WhatsApp, you can use Zospital" is almost exactly ClinicFlow's pitch.

**Their weakness:** no ABDM/NABH/ISO claims at all, no native app, no named payment gateway, contact-only sales.

### Lifemaan — **best billing/insurance depth + best language coverage**
Better at: the TPA/insurance lifecycle (documented above — genuinely impressive) · GST depth (GSTIN/HSN, slab-wise CGST/SGST vs IGST, CSV register for filing, credit notes) · **22-language** speech-to-Rx · tablet handwriting capture · two native apps · ABHA linking · auto vaccination reminders · AI queue ordering.

**Their weakness:** quote-based pricing with no public numbers, no ICD/drug-interaction/document-upload detail, no NABH/ISO.

### MocDoc — **the credential play**
Better at: **NABH Advanced Certified** (the only real accreditation in this set) · ABDM compliant · widest coding stack (ICD-10/9, SNOMED, LOINC, CDT, CPT) · 15+ named specialty templates with dental/ortho drawing tools · OT module, radiology/pathology · Aarogyasri/Ayushman Bharat TPA · claims 1,000+ reports · native apps · 7+ countries.

**Their weakness:** no public pricing (third-party estimates ₹60k–₹150k/yr), much specificity lives in blog posts not product pages, inconsistent report counts (300+ vs 1000+).

### Sanjeevani ERP — **the most honest competitor, and the closest price comparator**
**₹999/month Starter** with ABDM included. Publishes TLS 1.3 / AES-256 / Indian VPS hosting. Explicitly **disclaims** NABH and labels HIPAA as "aligned, not certified."

Better at: ABDM from day one incl. HFR + HPR registration and ABHA creation at reception · FHIR R4 · pharmacy FEFO · lab + radiology modules · IPD/bed board · digital token display · published tiered pricing · sets up your Google Business Profile and website during onboarding.

**Their transparency is a competitive weapon** — the explicit non-claims build more trust than the others' vague compliance badges. ClinicFlow should copy this posture.

### DocPulse — **best top-of-funnel capture**
Better at: **24/7 IVR voice booking** (nobody else has this) · unified calendar across IVR + web + app + reception · slot types (available/busy/reserved/emergency) · bulk reschedule with auto-notify · telemedicine with prepaid/postpaid · pharmacy · explicit **solo → clinic → hospital → chain** tiering with a clean upgrade story · native app · ICD-10 · drug interaction alerts.

**Their weakness:** **no ABDM/ABHA mention anywhere** (surprising), no public pricing, "SHA-256 encryption" (a hash, not a cipher — sloppy).

### MyKlinic — **the closest positioning twin** *(research thinner — the deep-dive agent hit a usage limit; this is from direct search)*
**Free Starter up to 1,000 patients; paid from ₹99/month.** Patients + appointments + prescriptions + WhatsApp notifications, responsive web, no app download. Paid unlocks reports, daily summaries, and **WhatsApp campaigns**.

**This is ClinicFlow's pitch at ₹99.** The most direct positioning collision in the set.

### Cufront — *(also from direct search)*
Built explicitly for **1–3 doctor clinics**. AI booking in **23 Indian languages**, WhatsApp reminders, digital prescriptions, **white-label patient app branded as the clinic**, IPD + pharmacy modules to grow into, setup in under one business day, 14-day trial. **₹2,000–8,000/month** for small clinics.

The white-label patient app is a real differentiator ClinicFlow has no answer to.

### EasyClinic / Healcard / ClinSav / BOOKNMEET — narrower threats
- **EasyClinic:** multi-location chains (100+), AI triage, personalised WhatsApp (birthdays/refills). But compliance is self-described "work in progress."
- **Healcard:** **WHO & IAP growth charts** (specific and India-correct), NFC patient cards, pharmacy expiry + sales analytics, 5-portal native app, SmartSuggest AI.
- **ClinSav:** the offline outlier — ₹299–449/mo, Android-only, data on-device. Note the inconsistency: markets "swipe and send" WhatsApp (manual handoff to the native app) yet also bundles "2,500 **automated** WhatsApp messages" — unresolved. **No pharmacy module, no ICD-10, no ABDM.** Its offline architecture is the only thing ClinicFlow can't match, and it's a real one.
- **BOOKNMEET:** 80,000-drug prescription DB and a queue/token system, but it's a thin marketplace shell (city pages showed 1–2 doctors per specialty). Not a serious threat.
- **Zoho Bookings / SimplyBook.me:** **not real competitors** — generic multi-industry schedulers with no EMR or prescriptions. Worth noting only because Zoho has a *native Meta WhatsApp connector* (bring your own WABA) and 75+ app integrations — an ecosystem story ClinicFlow lacks.

---

## 4. Where ClinicFlow is genuinely ahead

Not consolation prizes — these are real and defensible:

1. **WhatsApp transport transparency.** **Not one competitor discloses whether they use the official Meta Cloud API or a reseller BSP.** ClinicFlow uses Meta Cloud API directly, documented in the README. Cliniqwise comes closest ("Meta's base business rates with zero markup"). This is a genuine cost + trust + deliverability advantage — and **nobody is marketing it.** Free differentiation sitting on the table.
2. **DPDP-first architecture, actually implemented.** Per-clinic RLS on every table, consent + timestamp, JSON export, soft-delete → 30-day purge, Mumbai region. Most competitors say "DPDP compliant"; ClinicFlow's is in the migrations. Only Sanjeevani and Cliniqwise are comparable.
3. **Per-clinic link previews.** `/book/[slug]` generates a per-clinic OG card so a shared WhatsApp link previews as *the clinic*, not as the vendor. Nobody else markets this, and it's exactly right for the channel Indian clinics actually use.
4. **Bilingual message templates at the template layer** (en/hi per template, not machine-translated at send).
5. **Explicit instant-vs-approve booking modes.** Most competitors are vague about whether bookings auto-confirm. ClinicFlow makes it a per-clinic setting with OTP-verified instant confirmation.
6. **Honest UPI design.** The manual "Mark received" is the *correct* engineering call for personal VPAs — competitors claiming "auto-reconciliation" are almost certainly using merchant accounts and not saying so.
7. **Deliberately narrow scope.** No IPD/OT/bed bloat. Every competitor above ₹2,000/mo is selling hospital software to a solo doctor.
8. **Modern stack.** Next.js 16 RSC — faster than the PHP/legacy stacks most of these run on.

---

## 5. What to do — recommended order

**Now (weeks, high impact / low cost)**
1. **Expand the medicine database** from 129 → 10,000+. Pure data work. Removes the most immediately visible weakness.
2. **Drug-allergy interaction check** — you already store `allergies`; warn when a prescribed medicine matches. Patient safety, small effort.
3. **Waiting-room display** — read-only `/display/[slug]` showing the live token queue. Best effort-to-impact ratio in this document.
4. **Market the WhatsApp Cloud API story** — put "official Meta Cloud API, no reseller markup" on the landing page. Costs nothing, nobody else can say it.
5. **A `/security` page** — copy Sanjeevani's honest posture: state DPDP measures plainly, explicitly say what you *aren't* certified for.

**Next (quarter)**
6. **ABDM Milestone 1** — register on HFR/HPR, accept and store ABHA IDs. Even M1 alone unlocks the compliance badge everyone else is wearing.
7. **ICD-10 on diagnosis** — autocomplete over free text, keep the text field. Unlocks claims, analytics, and interoperability later.
8. **Document upload on visits** — S3/Supabase Storage; lets doctors attach outside reports. Currently disqualifying for several specialties.
9. **Vaccination reminders + review requests** — reuses the existing WhatsApp queue; directly matches Lifemaan and Zospital.
10. **Offline consult path** — service worker + queued writes, so a dropped connection doesn't stop the clinic.

**Watch, don't build yet**
- **AI voice → prescription.** Zospital's wedge. If it lands, it resets expectations for the whole category. Highest-risk item to ignore, but expensive to match — monitor before committing.
- **Pricing.** With Zospital free and MyKlinic at ₹99, ClinicFlow needs either a price near that floor or a crisp story for why it costs more (Cloud API deliverability, DPDP, no bloat).

**Explicitly don't build:** IPD/beds, OT, multi-branch, HR/payroll. These are what makes competitors bad at serving solo doctors — that's the opening.
