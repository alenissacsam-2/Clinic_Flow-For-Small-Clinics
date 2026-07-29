-- v7 Wave 1: give medicines an active-ingredient column and make the list
-- re-seedable.
--
-- `composition` is the join key for every clinical safety check: a patient's
-- recorded allergy ("Penicillin") is matched against ingredients, not brand
-- names, so prescribing "Augmentin" correctly fires a penicillin warning.
-- Without this column the safety engine can only string-match brand names,
-- which is exactly the false-reassurance failure mode we're trying to remove.
--
-- Also fixes a latent display bug: 0003 seeded unknown strengths as the em-dash
-- '—' (U+2014), but medicine-combobox.tsx tested for an ASCII '-', so those rows
-- rendered a stray dash in the picker. Unknown strength is now NULL.

alter table medicines add column if not exists composition text;
alter table medicines add column if not exists is_active boolean not null default true;

-- '—' / '-' were stand-ins for "no single strength" (combination products,
-- syrups, powders). NULL says that properly and matches the component's check.
update medicines set strength = null where strength in ('—', '-', '');

-- Brand and combination rows: map to actual active ingredients. Generic-named
-- rows fall through to the `composition = name` default below.
update medicines m set composition = v.composition
from (values
  ('Dolo 650',                      'Paracetamol'),
  ('Crocin',                        'Paracetamol'),
  ('Combiflam',                     'Ibuprofen + Paracetamol'),
  ('Zerodol-P',                     'Aceclofenac + Paracetamol'),
  ('Augmentin',                     'Amoxicillin + Clavulanic Acid'),
  ('Amoxicillin + Clavulanate',     'Amoxicillin + Clavulanic Acid'),
  ('Azithral',                      'Azithromycin'),
  ('Taxim-O',                       'Cefixime'),
  ('Cotrimoxazole',                 'Sulfamethoxazole + Trimethoprim'),
  ('Pan 40',                        'Pantoprazole'),
  ('Rantac',                        'Ranitidine'),
  ('Emeset',                        'Ondansetron'),
  ('Digene',                        'Magaldrate + Simethicone'),
  ('Gelusil',                       'Aluminium Hydroxide + Magnesium Hydroxide + Simethicone'),
  ('Meftal Spas',                   'Mefenamic Acid + Dicyclomine'),
  ('ORS',                           'Oral Rehydration Salts'),
  ('Isabgol',                       'Ispaghula Husk'),
  ('Cheston Cold',                  'Cetirizine + Paracetamol + Phenylephrine'),
  ('Sinarest',                      'Paracetamol + Chlorpheniramine + Phenylephrine'),
  ('Ascoril',                       'Ambroxol + Guaifenesin + Levosalbutamol'),
  ('Grilinctus',                    'Chlorpheniramine + Dextromethorphan + Guaifenesin'),
  ('Asthalin',                      'Salbutamol'),
  ('Deriphyllin',                   'Etophylline + Theophylline'),
  ('Insulin (Human Mixtard)',       'Insulin Human'),
  ('Vitamin D3 (60K)',              'Cholecalciferol'),
  ('Calcium + Vitamin D3',          'Calcium Carbonate + Cholecalciferol'),
  ('Shelcal',                       'Calcium Carbonate + Cholecalciferol'),
  ('Vitamin B-Complex',             'B-Complex Vitamins'),
  ('Becosules',                     'B-Complex Vitamins'),
  ('Livogen',                       'Ferrous Fumarate + Folic Acid'),
  ('Zincovit',                      'Multivitamin + Zinc'),
  ('Vitamin C',                     'Ascorbic Acid'),
  ('Otrivin',                       'Xylometazoline'),
  ('Xylometazoline Nasal Drops',    'Xylometazoline'),
  ('Moxifloxacin Eye Drops',        'Moxifloxacin'),
  ('Ciprofloxacin Ear Drops',       'Ciprofloxacin'),
  ('Thyroxine',                     'Levothyroxine'),
  ('Thyronorm',                     'Levothyroxine')
) as v(name, composition)
where m.name = v.name and m.composition is null;

-- Everything else is already named for its ingredient.
update medicines set composition = name where composition is null;

-- Collapse any duplicate rows before the unique index can be created. Global
-- rows carry clinic_id = NULL, and NULLs are distinct to a plain unique index,
-- so both here and in the index the id is coalesced to a fixed sentinel.
-- `form` is part of the key: "Lignocaine Inj 2%" and "Lignocaine Gel 2%" are
-- different products and must both survive.
delete from medicines a using medicines b
 where a.ctid > b.ctid
   and coalesce(a.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = coalesce(b.clinic_id, '00000000-0000-0000-0000-000000000000'::uuid)
   and lower(a.name) = lower(b.name)
   and lower(coalesce(a.form, '')) = lower(coalesce(b.form, ''))
   and lower(coalesce(a.strength, '')) = lower(coalesce(b.strength, ''));

-- Makes the seed and the CSV importer re-runnable via `on conflict do nothing`.
create unique index if not exists medicines_dedupe_uniq on medicines
  (coalesce(clinic_id, '00000000-0000-0000-0000-000000000000'::uuid),
   lower(name), lower(coalesce(form, '')), lower(coalesce(strength, '')));

create index if not exists medicines_composition_trgm
  on medicines using gin (composition gin_trgm_ops);
