-- v7 Wave 1: drug–drug interaction rules.
--
-- SCOPE AND LIMITS — read before relying on this.
-- CURATED AND NON-EXHAUSTIVE. These are widely documented, clinically
-- significant interactions — not the full interaction space of a licensed
-- drug-safety database. A pair that produces no warning has NOT been cleared;
-- it may simply be absent here. The UI presents every result as advisory and
-- never blocks a prescription. Clinics may load a licensed rule set as
-- clinic-scoped rows (clinic_id set), exactly like the medicines list.
--
-- Either side may be a plain ingredient ('warfarin') or a class token
-- ('class:nsaid'). Class tokens are expanded by DRUG_CLASSES in
-- src/lib/clinical/safety.ts, so one row covers a whole family. Matching is
-- always on active ingredients, never brand names.

create table if not exists drug_interactions (
  id           uuid primary key default gen_random_uuid(),
  clinic_id    uuid references clinics(id) on delete cascade,  -- NULL = global seed row
  ingredient_a text not null,
  ingredient_b text not null,
  severity     text not null check (severity in ('major','moderate','minor')),
  description  text not null,
  source       text,
  created_at   timestamptz not null default now()
);

alter table drug_interactions enable row level security;

-- Mirrors the medicines global-plus-tenant policy set (0002_rls.sql).
drop policy if exists drug_interactions_read on drug_interactions;
create policy drug_interactions_read on drug_interactions for select
  using (clinic_id is null or clinic_id in (select auth_clinic_ids()));

drop policy if exists drug_interactions_write on drug_interactions;
create policy drug_interactions_write on drug_interactions for insert
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists drug_interactions_update on drug_interactions;
create policy drug_interactions_update on drug_interactions for update
  using (clinic_id in (select auth_clinic_ids()))
  with check (clinic_id in (select auth_clinic_ids()));

drop policy if exists drug_interactions_delete on drug_interactions;
create policy drug_interactions_delete on drug_interactions for delete
  using (clinic_id in (select auth_clinic_ids()));

-- Pairs are stored lower-cased and alphabetically ordered so lookup is
-- direction-free and the index actually dedupes.
create unique index if not exists drug_interactions_uniq on drug_interactions
  (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
   lower(least(ingredient_a, ingredient_b)),
   lower(greatest(ingredient_a, ingredient_b)));

insert into drug_interactions (clinic_id, ingredient_a, ingredient_b, severity, description, source) values

-- ── Anticoagulants / antiplatelets: bleeding ──────────────────────────────
(null,'warfarin','class:nsaid','major','Markedly increased bleeding risk; NSAIDs also displace warfarin and irritate gastric mucosa. Avoid, or use gastroprotection with close INR monitoring.','Well-established'),
(null,'warfarin','class:macrolide','major','Macrolides inhibit warfarin metabolism — INR can rise sharply. Monitor INR closely.','Well-established'),
(null,'warfarin','fluconazole','major','Fluconazole strongly inhibits warfarin metabolism; substantial INR rise expected.','Well-established'),
(null,'warfarin','metronidazole','major','Metronidazole inhibits warfarin metabolism; INR rises. Monitor closely.','Well-established'),
(null,'warfarin','sulfamethoxazole','major','Co-trimoxazole raises INR substantially and adds antiplatelet effect.','Well-established'),
(null,'warfarin','amiodarone','major','Amiodarone inhibits warfarin metabolism; warfarin dose usually needs reduction.','Well-established'),
(null,'warfarin','rifampicin','major','Rifampicin induces warfarin metabolism — INR falls and anticoagulation may be lost.','Well-established'),
(null,'warfarin','class:quinolone','moderate','Fluoroquinolones may potentiate warfarin; monitor INR.','Documented'),
(null,'acenocoumarol','class:nsaid','major','Increased bleeding risk with concurrent NSAID use.','Well-established'),
(null,'rivaroxaban','class:nsaid','major','Additive bleeding risk with NSAIDs.','Well-established'),
(null,'apixaban','class:nsaid','major','Additive bleeding risk with NSAIDs.','Well-established'),
(null,'dabigatran','class:nsaid','major','Additive bleeding risk with NSAIDs.','Well-established'),
(null,'enoxaparin','class:nsaid','major','Additive bleeding risk with NSAIDs.','Well-established'),
(null,'clopidogrel','class:nsaid','moderate','Additive bleeding risk, particularly gastrointestinal.','Well-established'),
(null,'clopidogrel','omeprazole','major','Omeprazole inhibits CYP2C19 and reduces clopidogrel activation, lowering antiplatelet effect. Prefer pantoprazole.','Well-established'),
(null,'clopidogrel','esomeprazole','major','Esomeprazole reduces clopidogrel activation via CYP2C19. Prefer pantoprazole.','Well-established'),
(null,'aspirin','warfarin','major','Additive bleeding risk; use together only on a clear indication.','Well-established'),

-- ── Statins: myopathy / rhabdomyolysis ────────────────────────────────────
(null,'class:statin','clarithromycin','major','Clarithromycin inhibits statin metabolism — risk of myopathy and rhabdomyolysis. Suspend the statin during the course.','Well-established'),
(null,'class:statin','erythromycin','major','Erythromycin inhibits statin metabolism; myopathy risk.','Well-established'),
(null,'class:statin','itraconazole','major','Azole antifungals inhibit statin metabolism; rhabdomyolysis risk.','Well-established'),
(null,'class:statin','colchicine','moderate','Additive myopathy risk; monitor for muscle pain and weakness.','Documented'),
(null,'simvastatin','amlodipine','moderate','Amlodipine raises simvastatin exposure; limit simvastatin dose.','Well-established'),
(null,'class:statin','rifampicin','moderate','Rifampicin induces statin metabolism, reducing lipid-lowering effect.','Documented'),

-- ── Renal / electrolyte ───────────────────────────────────────────────────
(null,'class:ace','spironolactone','major','Additive hyperkalaemia risk. Monitor potassium and renal function.','Well-established'),
(null,'class:ace','potassium chloride','major','Additive hyperkalaemia risk.','Well-established'),
(null,'class:arb','spironolactone','major','Additive hyperkalaemia risk. Monitor potassium and renal function.','Well-established'),
(null,'class:arb','potassium chloride','major','Additive hyperkalaemia risk.','Well-established'),
(null,'spironolactone','potassium chloride','major','Additive hyperkalaemia risk.','Well-established'),
(null,'class:ace','class:nsaid','moderate','NSAIDs blunt the antihypertensive effect and, with a diuretic, raise acute kidney injury risk ("triple whammy").','Well-established'),
(null,'class:arb','class:nsaid','moderate','NSAIDs blunt the antihypertensive effect and increase renal risk.','Well-established'),
(null,'furosemide','class:nsaid','moderate','NSAIDs reduce diuretic efficacy and add renal risk.','Well-established'),
(null,'lithium carbonate','class:nsaid','major','NSAIDs reduce lithium clearance — toxicity risk. Monitor lithium levels.','Well-established'),
(null,'lithium carbonate','class:ace','major','ACE inhibitors reduce lithium clearance; toxicity risk.','Well-established'),
(null,'lithium carbonate','hydrochlorothiazide','major','Thiazides reduce lithium clearance; toxicity risk.','Well-established'),

-- ── Serotonergic / CNS ────────────────────────────────────────────────────
(null,'tramadol','class:ssri','major','Serotonin syndrome risk; tramadol also lowers the seizure threshold.','Well-established'),
(null,'tramadol','amitriptyline','major','Serotonin syndrome and additive seizure risk.','Well-established'),
(null,'tramadol','duloxetine','major','Serotonin syndrome risk.','Well-established'),
(null,'linezolid','class:ssri','major','Linezolid is a weak MAO inhibitor — serotonin syndrome risk.','Well-established'),
(null,'class:ssri','class:nsaid','moderate','Additive gastrointestinal bleeding risk; consider gastroprotection.','Well-established'),
(null,'class:ssri','amitriptyline','moderate','SSRIs raise tricyclic levels; additive serotonergic effect.','Documented'),
(null,'class:ssri','aspirin','moderate','Additive gastrointestinal bleeding risk.','Documented'),
(null,'fluoxetine','sertraline','moderate','Duplicate SSRI therapy — additive serotonergic effect.','Documented'),
(null,'metoclopramide','levodopa','moderate','Metoclopramide antagonises levodopa and can worsen parkinsonism.','Well-established'),
(null,'class:benzodiazepine','tramadol','moderate','Additive CNS and respiratory depression.','Documented'),

-- ── Enzyme induction / inhibition ─────────────────────────────────────────
(null,'phenytoin','fluconazole','major','Fluconazole inhibits phenytoin metabolism; toxicity risk.','Well-established'),
(null,'carbamazepine','class:macrolide','major','Macrolides inhibit carbamazepine metabolism; toxicity risk.','Well-established'),
(null,'carbamazepine','ethinylestradiol','major','Enzyme induction reduces contraceptive efficacy — advise additional contraception.','Well-established'),
(null,'phenytoin','ethinylestradiol','major','Enzyme induction reduces contraceptive efficacy.','Well-established'),
(null,'rifampicin','ethinylestradiol','major','Rifampicin markedly reduces contraceptive efficacy — additional contraception required.','Well-established'),
(null,'theophylline','ciprofloxacin','major','Ciprofloxacin inhibits theophylline metabolism; toxicity and seizure risk.','Well-established'),
(null,'theophylline','class:macrolide','moderate','Macrolides raise theophylline levels; monitor for toxicity.','Well-established'),
(null,'tizanidine','ciprofloxacin','major','Ciprofloxacin markedly raises tizanidine levels — hypotension and sedation.','Well-established'),
(null,'colchicine','clarithromycin','major','Clarithromycin raises colchicine levels; potentially fatal toxicity.','Well-established'),

-- ── Cardiac ───────────────────────────────────────────────────────────────
(null,'digoxin','amiodarone','major','Amiodarone raises digoxin levels; halve the digoxin dose and monitor.','Well-established'),
(null,'digoxin','furosemide','moderate','Diuretic-induced hypokalaemia potentiates digoxin toxicity. Monitor potassium.','Well-established'),
(null,'digoxin','spironolactone','moderate','Spironolactone raises digoxin levels.','Documented'),
(null,'digoxin','clarithromycin','major','Clarithromycin raises digoxin levels; toxicity risk.','Well-established'),
(null,'class:beta_blocker','salbutamol','moderate','Beta-blockers antagonise salbutamol; non-selective agents (propranolol) may provoke bronchospasm in asthma.','Well-established'),
(null,'propranolol','salbutamol','major','Non-selective beta-blockade can precipitate bronchospasm and blocks salbutamol rescue.','Well-established'),
(null,'verapamil','class:beta_blocker','major','Additive bradycardia and AV block.','Well-established'),

-- ── Absorption / chelation ────────────────────────────────────────────────
(null,'levothyroxine','calcium carbonate','moderate','Calcium reduces levothyroxine absorption. Separate doses by at least 4 hours.','Well-established'),
(null,'levothyroxine','ferrous sulphate','moderate','Iron reduces levothyroxine absorption. Separate doses by at least 4 hours.','Well-established'),
(null,'levothyroxine','ferrous fumarate','moderate','Iron reduces levothyroxine absorption. Separate doses by at least 4 hours.','Well-established'),
(null,'levothyroxine','class:ppi','moderate','Reduced gastric acidity lowers levothyroxine absorption; monitor TSH.','Documented'),
(null,'class:quinolone','calcium carbonate','moderate','Cations chelate fluoroquinolones, sharply reducing absorption. Separate by 2–4 hours.','Well-established'),
(null,'class:quinolone','ferrous sulphate','moderate','Iron chelates fluoroquinolones, reducing absorption. Separate by 2–4 hours.','Well-established'),
(null,'class:tetracycline','calcium carbonate','moderate','Calcium chelates tetracyclines, reducing absorption. Separate by 2–4 hours.','Well-established'),
(null,'class:tetracycline','ferrous sulphate','moderate','Iron chelates tetracyclines, reducing absorption.','Well-established'),
(null,'itraconazole','class:ppi','moderate','Reduced gastric acidity lowers itraconazole absorption.','Well-established'),

-- ── Gastrointestinal / steroid ────────────────────────────────────────────
(null,'prednisolone','class:nsaid','moderate','Additive risk of peptic ulceration and GI bleeding; consider gastroprotection.','Well-established'),
(null,'methylprednisolone','class:nsaid','moderate','Additive risk of peptic ulceration and GI bleeding.','Well-established'),
(null,'prednisolone','aspirin','moderate','Additive gastrointestinal ulceration risk.','Well-established'),

-- ── Antimetabolite / immunosuppressant ────────────────────────────────────
(null,'methotrexate','class:nsaid','major','NSAIDs reduce methotrexate clearance — marrow suppression and toxicity risk.','Well-established'),
(null,'methotrexate','sulfamethoxazole','major','Additive antifolate effect; risk of severe myelosuppression. Avoid.','Well-established'),
(null,'methotrexate','aspirin','major','Reduced methotrexate clearance; toxicity risk.','Well-established'),

-- ── Antidiabetic ──────────────────────────────────────────────────────────
(null,'metformin','furosemide','minor','Loop diuretics may alter metformin levels; clinically minor but monitor renal function.','Documented'),
(null,'glimepiride','class:nsaid','moderate','NSAIDs may potentiate sulfonylurea hypoglycaemia.','Documented'),
(null,'glimepiride','fluconazole','moderate','Fluconazole raises sulfonylurea levels; hypoglycaemia risk.','Documented'),
(null,'insulin human','class:beta_blocker','moderate','Beta-blockers can mask the adrenergic warning signs of hypoglycaemia.','Well-established')

on conflict do nothing;
