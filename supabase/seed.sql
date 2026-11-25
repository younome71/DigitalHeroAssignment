-- ============================================================================
-- Digital Heroes — Seed data
-- 6 divisions · parameter-driven products · template print-areas · gallery
-- Idempotent: re-runnable via ON CONFLICT upserts.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Divisions
-- ----------------------------------------------------------------------------
insert into public.divisions (slug, name, tagline, description, accent_color, hero_image_url, sort_order)
values
  ('labels-stickers',    'Labels & Stickers',    'Precision-cut, production-ready.',
   'Roll labels, sheet stickers and die-cut decals — engineered for shelf appeal and durability.',
   '#E85D04', '/divisions/labels-stickers.jpg', 10),
  ('race-event-numbers', 'Race & Event Numbers', 'Built for the start line.',
   'Tyvek bibs, wristbands and event signage built to survive mud, sweat and weather.',
   '#E85D04', '/divisions/race-event-numbers.jpg', 20),
  ('mtb-boards',         'MTB Boards',           'Number plates that take a hit.',
   'Corflute and PVC number boards for downhill, enduro and cross-country events.',
   '#E85D04', '/divisions/mtb-boards.jpg', 30),
  ('stamps',             'Stamps',               'Ink meets precision.',
   'Self-inking and traditional stamps for high-frequency professional use.',
   '#E85D04', '/divisions/stamps.jpg', 40),
  ('trophies',           'Trophies',             'Weight, finish, legacy.',
   'Acrylic plaques and laser-cut trophies that celebrate the win properly.',
   '#E85D04', '/divisions/trophies.jpg', 50),
  ('laser-cut',          'Laser-Cut Work',       'From flat sheet to finished object.',
   'Signage, ornaments and fabricated objects in plywood, MDF and acrylic.',
   '#E85D04', '/divisions/laser-cut.jpg', 60)
on conflict (slug) do update
  set name           = excluded.name,
      tagline        = excluded.tagline,
      description    = excluded.description,
      accent_color   = excluded.accent_color,
      hero_image_url = excluded.hero_image_url,
      sort_order     = excluded.sort_order,
      active         = true;

-- ----------------------------------------------------------------------------
-- Products — Labels & Stickers
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'roll-labels', 'Custom Roll Labels',
  'Premium roll labels on vinyl, clear or paper stock. Die-cut to size, supplied on rolls.',
  45, 30, 200, 20, 150,
  '[{"id":"vinyl-white","label":"White Vinyl","priceMultiplier":1.0},
    {"id":"vinyl-clear","label":"Clear Vinyl","priceMultiplier":1.15},
    {"id":"paper-gloss","label":"Gloss Paper","priceMultiplier":0.85},
    {"id":"paper-matte","label":"Matte Paper","priceMultiplier":0.90}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  3, 2, 300, 15.00,
  '[{"min_qty":100,"discount_percent":5},
    {"min_qty":500,"discount_percent":12},
    {"min_qty":1000,"discount_percent":20}]'::jsonb,
  '{"mode":"shrink","min_font_size":6,"max_font_size":72,"letter_spacing_min":-2,"letter_spacing_max":8}'::jsonb,
  5
from public.divisions d
where d.slug = 'labels-stickers'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'sheet-stickers', 'Sheet Stickers',
  'Multi-up sticker sheets — A4 and A3 — kiss-cut and ready to peel.',
  85, 40, 180, 40, 180,
  '[{"id":"vinyl-white","label":"White Vinyl","priceMultiplier":1.0},
    {"id":"kraft","label":"Kraft Paper","priceMultiplier":0.95}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  2, 2, 300, 15.00,
  '[{"min_qty":50,"discount_percent":5},
    {"min_qty":200,"discount_percent":15}]'::jsonb,
  '{"mode":"shrink","min_font_size":6,"max_font_size":72,"letter_spacing_min":-1,"letter_spacing_max":6}'::jsonb,
  4
from public.divisions d
where d.slug = 'labels-stickers'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Products — Race & Event Numbers
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'race-bibs', 'Custom Race Bibs',
  'Tyvek race bibs with variable-data race numbers, participant names and event branding.',
  185, 150, 250, 200, 350,
  '[{"id":"tyvek-synthetic","label":"Tyvek Synthetic","priceMultiplier":1.0},
    {"id":"waterproof-synthetic","label":"Waterproof Synthetic","priceMultiplier":1.20}]'::jsonb,
  '["portrait"]'::jsonb,
  2, 3, 300, 15.00,
  '[{"min_qty":50,"discount_percent":10},
    {"min_qty":200,"discount_percent":20},
    {"min_qty":500,"discount_percent":30}]'::jsonb,
  '{"mode":"shrink","min_font_size":8,"max_font_size":240,"letter_spacing_min":-3,"letter_spacing_max":10}'::jsonb,
  6
from public.divisions d
where d.slug = 'race-event-numbers'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'event-wristbands', 'Event Wristbands',
  'Tyvek event wristbands with printed colour coding and variable participant data.',
  120, 200, 250, 25, 25,
  '[{"id":"tyvek","label":"Tyvek","priceMultiplier":1.0}]'::jsonb,
  '["landscape"]'::jsonb,
  1, 1, 300, 15.00,
  '[{"min_qty":100,"discount_percent":8},
    {"min_qty":500,"discount_percent":22}]'::jsonb,
  '{"mode":"shrink","min_font_size":6,"max_font_size":40,"letter_spacing_min":-1,"letter_spacing_max":4}'::jsonb,
  6
from public.divisions d
where d.slug = 'race-event-numbers'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Products — MTB Boards
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'number-boards', 'MTB Number Boards',
  'Weatherproof corflute or PVC number boards for downhill, enduro and XC events.',
  1200, 250, 350, 200, 300,
  '[{"id":"corflute-4mm","label":"Corflute 4mm","priceMultiplier":1.0},
    {"id":"pvc-3mm","label":"PVC 3mm","priceMultiplier":1.30}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  3, 4, 300, 15.00,
  '[{"min_qty":25,"discount_percent":8},
    {"min_qty":100,"discount_percent":18}]'::jsonb,
  '{"mode":"shrink","min_font_size":24,"max_font_size":400,"letter_spacing_min":-4,"letter_spacing_max":10}'::jsonb,
  7
from public.divisions d
where d.slug = 'mtb-boards'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Products — Stamps
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'self-inking-stamp', 'Self-Inking Stamp',
  'Refillable self-inking stamp with custom text and simple graphics. Ships ready-to-use.',
  4500, 38, 75, 14, 38,
  '[{"id":"self-inking","label":"Self-Inking","priceMultiplier":1.0}]'::jsonb,
  '["landscape"]'::jsonb,
  0, 2, 600, 15.00,
  '[]'::jsonb,
  '{"mode":"shrink","min_font_size":6,"max_font_size":32,"letter_spacing_min":-1,"letter_spacing_max":3}'::jsonb,
  4
from public.divisions d
where d.slug = 'stamps'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Products — Trophies
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'acrylic-plaque', 'Custom Acrylic Plaque',
  'Premium laser-engraved acrylic plaque with optional standoffs.',
  6500, 100, 300, 100, 200,
  '[{"id":"acrylic-clear","label":"Clear Acrylic","priceMultiplier":1.0},
    {"id":"acrylic-black","label":"Black Acrylic","priceMultiplier":1.10}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  2, 3, 600, 15.00,
  '[{"min_qty":5,"discount_percent":5},
    {"min_qty":20,"discount_percent":12}]'::jsonb,
  '{"mode":"shrink","min_font_size":10,"max_font_size":96,"letter_spacing_min":-2,"letter_spacing_max":8}'::jsonb,
  8
from public.divisions d
where d.slug = 'trophies'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'laser-trophy', 'Laser-Cut Trophy',
  'Laser-cut trophy silhouette with engraved personalisation.',
  8900, 120, 200, 180, 300,
  '[{"id":"ply-wood","label":"Ply Wood","priceMultiplier":1.0},
    {"id":"acrylic","label":"Acrylic","priceMultiplier":1.20}]'::jsonb,
  '["portrait"]'::jsonb,
  2, 3, 600, 15.00,
  '[{"min_qty":5,"discount_percent":5},
    {"min_qty":20,"discount_percent":12}]'::jsonb,
  '{"mode":"shrink","min_font_size":10,"max_font_size":96,"letter_spacing_min":-2,"letter_spacing_max":8}'::jsonb,
  8
from public.divisions d
where d.slug = 'trophies'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Products — Laser-Cut
-- ----------------------------------------------------------------------------
insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'laser-cut-sign', 'Laser-Cut Sign',
  'Bold laser-cut signage in plywood, MDF or acrylic. Ready to hang.',
  12000, 200, 800, 100, 400,
  '[{"id":"ply-wood","label":"Ply Wood","priceMultiplier":1.0},
    {"id":"mdf","label":"MDF","priceMultiplier":0.90},
    {"id":"acrylic","label":"Acrylic","priceMultiplier":1.25}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  3, 5, 300, 15.00,
  '[{"min_qty":5,"discount_percent":5},
    {"min_qty":20,"discount_percent":15}]'::jsonb,
  '{"mode":"shrink","min_font_size":12,"max_font_size":200,"letter_spacing_min":-3,"letter_spacing_max":10}'::jsonb,
  10
from public.divisions d
where d.slug = 'laser-cut'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

insert into public.products (
  division_id, slug, name, description,
  base_price_cents, min_width_mm, max_width_mm, min_height_mm, max_height_mm,
  allowed_materials, allowed_orientations, bleed_mm, safe_margin_mm, target_dpi,
  vat_percent, volume_discount_tiers, template_fit_rules, turnaround_days
)
select
  d.id, 'laser-cut-ornament', 'Laser-Cut Ornament',
  'Small laser-cut ornaments and decorations in ply or acrylic.',
  800, 60, 150, 60, 150,
  '[{"id":"ply-wood","label":"Ply Wood","priceMultiplier":1.0},
    {"id":"acrylic","label":"Acrylic","priceMultiplier":1.25}]'::jsonb,
  '["landscape","portrait"]'::jsonb,
  2, 3, 300, 15.00,
  '[{"min_qty":50,"discount_percent":8},
    {"min_qty":200,"discount_percent":20}]'::jsonb,
  '{"mode":"shrink","min_font_size":8,"max_font_size":64,"letter_spacing_min":-1,"letter_spacing_max":6}'::jsonb,
  7
from public.divisions d
where d.slug = 'laser-cut'
on conflict (division_id, slug) do update
  set name = excluded.name,
      description = excluded.description,
      base_price_cents = excluded.base_price_cents,
      allowed_materials = excluded.allowed_materials,
      volume_discount_tiers = excluded.volume_discount_tiers,
      active = true;

-- ----------------------------------------------------------------------------
-- Templates — one standard per key product
-- print_area and placeholder bounds are expressed in canvas px.
-- ----------------------------------------------------------------------------

-- 1) Race Bibs — Standard
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Race Bib', '/templates/race-bib-standard.png',
  1000, 1400,
  '{"x":100,"y":100,"width":800,"height":1200}'::jsonb,
  '[
    {"id":"number","type":"text","label":"Race Number","maxLength":6,"required":true,"defaultText":"0000",
     "bounds":{"x":100,"y":280,"width":800,"height":420},"fontSize":340,"fontFamily":"Inter","align":"center"},
    {"id":"name","type":"text","label":"Participant Name","maxLength":24,"required":false,"defaultText":"YOUR NAME",
     "bounds":{"x":100,"y":740,"width":800,"height":150},"fontSize":72,"fontFamily":"Inter","align":"center"},
    {"id":"event","type":"text","label":"Event Name","maxLength":40,"required":true,"defaultText":"EVENT",
     "bounds":{"x":100,"y":1000,"width":800,"height":200},"fontSize":96,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/race-bib-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'race-event-numbers' and p.slug = 'race-bibs'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 2) Race Bibs — Compact
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Compact Race Bib', '/templates/race-bib-compact.png',
  800, 1100,
  '{"x":80,"y":80,"width":640,"height":940}'::jsonb,
  '[
    {"id":"number","type":"text","label":"Race Number","maxLength":5,"required":true,"defaultText":"0000",
     "bounds":{"x":80,"y":180,"width":640,"height":340},"fontSize":280,"fontFamily":"Inter","align":"center"},
    {"id":"event","type":"text","label":"Event Name","maxLength":32,"required":true,"defaultText":"EVENT",
     "bounds":{"x":80,"y":820,"width":640,"height":160},"fontSize":80,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/race-bib-compact-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'race-event-numbers' and p.slug = 'race-bibs'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 3) Roll Labels — Round 50mm
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Round 50mm Label', '/templates/roll-labels-round50.png',
  600, 600,
  '{"x":50,"y":50,"width":500,"height":500}'::jsonb,
  '[
    {"id":"brand","type":"text","label":"Brand Name","maxLength":22,"required":true,"defaultText":"BRAND",
     "bounds":{"x":80,"y":220,"width":440,"height":100},"fontSize":64,"fontFamily":"Inter","align":"center"},
    {"id":"sub","type":"text","label":"Sub Text","maxLength":30,"required":false,"defaultText":"Sub",
     "bounds":{"x":80,"y":320,"width":440,"height":70},"fontSize":36,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/roll-labels-round50-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'labels-stickers' and p.slug = 'roll-labels'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 4) Sheet Stickers — A4 multi-up
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'A4 Multi-up Sheet', '/templates/sheet-stickers-a4.png',
  1000, 1414,
  '{"x":50,"y":50,"width":900,"height":1314}'::jsonb,
  '[
    {"id":"title","type":"text","label":"Sheet Title","maxLength":24,"required":false,"defaultText":"TITLE",
     "bounds":{"x":50,"y":50,"width":900,"height":100},"fontSize":64,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/sheet-stickers-a4-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'labels-stickers' and p.slug = 'sheet-stickers'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 5) MTB Number Boards — Standard
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Number Board', '/templates/mtb-boards-standard.png',
  1000, 800,
  '{"x":75,"y":75,"width":850,"height":650}'::jsonb,
  '[
    {"id":"number","type":"text","label":"Race Number","maxLength":4,"required":true,"defaultText":"00",
     "bounds":{"x":75,"y":150,"width":850,"height":350},"fontSize":380,"fontFamily":"Inter","align":"center"},
    {"id":"series","type":"text","label":"Series Name","maxLength":32,"required":true,"defaultText":"SERIES",
     "bounds":{"x":75,"y":520,"width":850,"height":120},"fontSize":88,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/mtb-boards-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'mtb-boards' and p.slug = 'number-boards'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 6) Self-Inking Stamp — Standard
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Self-Inking', '/templates/stamp-standard.png',
  600, 300,
  '{"x":40,"y":40,"width":520,"height":220}'::jsonb,
  '[
    {"id":"line1","type":"text","label":"Line 1","maxLength":28,"required":true,"defaultText":"LINE ONE",
     "bounds":{"x":40,"y":60,"width":520,"height":90},"fontSize":56,"fontFamily":"Inter","align":"center"},
    {"id":"line2","type":"text","label":"Line 2","maxLength":28,"required":false,"defaultText":"Line Two",
     "bounds":{"x":40,"y":150,"width":520,"height":70},"fontSize":40,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/stamp-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'stamps' and p.slug = 'self-inking-stamp'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 7) Acrylic Plaque — Standard
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Plaque', '/templates/acrylic-plaque-standard.png',
  800, 600,
  '{"x":60,"y":60,"width":680,"height":480}'::jsonb,
  '[
    {"id":"title","type":"text","label":"Award Title","maxLength":32,"required":true,"defaultText":"AWARD",
     "bounds":{"x":60,"y":180,"width":680,"height":130},"fontSize":96,"fontFamily":"Inter","align":"center"},
    {"id":"subtitle","type":"text","label":"Recipient","maxLength":40,"required":true,"defaultText":"RECIPIENT",
     "bounds":{"x":60,"y":330,"width":680,"height":100},"fontSize":64,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/acrylic-plaque-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'trophies' and p.slug = 'acrylic-plaque'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 8) Laser-Cut Sign — Standard (NEW — completes the seed)
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Sign', '/templates/laser-cut-sign-standard.png',
  1600, 800,
  '{"x":80,"y":80,"width":1440,"height":640}'::jsonb,
  '[
    {"id":"headline","type":"text","label":"Headline","maxLength":36,"required":true,"defaultText":"HEADLINE",
     "bounds":{"x":80,"y":220,"width":1440,"height":240},"fontSize":220,"fontFamily":"Inter","align":"center"},
    {"id":"subhead","type":"text","label":"Subhead","maxLength":64,"required":false,"defaultText":"Subhead goes here",
     "bounds":{"x":80,"y":490,"width":1440,"height":130},"fontSize":96,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/laser-cut-sign-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'laser-cut' and p.slug = 'laser-cut-sign'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- 9) Laser-Cut Ornament — Standard (NEW — completes the seed)
insert into public.templates (
  product_id, name, preview_url, canvas_width_px, canvas_height_px,
  print_area, placeholder_definitions, background_url
)
select
  p.id, 'Standard Ornament', '/templates/laser-cut-ornament-standard.png',
  600, 600,
  '{"x":60,"y":60,"width":480,"height":480}'::jsonb,
  '[
    {"id":"name","type":"text","label":"Name / Year","maxLength":20,"required":true,"defaultText":"2025",
     "bounds":{"x":60,"y":250,"width":480,"height":120},"fontSize":88,"fontFamily":"Inter","align":"center"}
  ]'::jsonb,
  '/templates/laser-cut-ornament-standard-bg.png'
from public.products p
join public.divisions d on d.id = p.division_id
where d.slug = 'laser-cut' and p.slug = 'laser-cut-ornament'
on conflict (product_id, name) do update
  set preview_url = excluded.preview_url,
      canvas_width_px = excluded.canvas_width_px,
      canvas_height_px = excluded.canvas_height_px,
      print_area = excluded.print_area,
      placeholder_definitions = excluded.placeholder_definitions,
      background_url = excluded.background_url;

-- ----------------------------------------------------------------------------
-- Gallery items — 12 across 6 divisions (2 per division)
-- ----------------------------------------------------------------------------
insert into public.gallery_items (
  division_id, title, description, image_url, customer_name, tags, featured, sort_order
)
select d.id, g.title, g.description, g.image_url, g.customer_name, g.tags::jsonb, g.featured, g.sort_order
from public.divisions d
join (values
  -- Labels & Stickers
  ('labels-stickers', 'Monsoon Coffee Roasters',
   'Die-cut roll labels on matte stock, foil-accented for shelf presence.',
   '/gallery/monsoon-coffee-labels.jpg', 'Monsoon Coffee',
   '["labels","coffee","foil"]', true, 10),
  ('labels-stickers', 'Kōwhai Botanics',
   'A4 sheet stickers, kiss-cut, kraft paper with water-based inks.',
   '/gallery/kowhai-botanics-stickers.jpg', 'Kōwhai Botanics',
   '["stickers","botanical","kraft"]', false, 20),

  -- Race & Event Numbers
  ('race-event-numbers', 'Tarawera Ultra 100K Bibs',
   'Tyvek bibs with variable-data race numbers and participant names for 1,400 runners.',
   '/gallery/tarawera-ultra-bibs.jpg', 'Tarawera Ultra',
   '["bibs","ultra","tyvek"]', true, 10),
  ('race-event-numbers', 'Southern Cross Marathon Wristbands',
   'Colour-coded Tyvek wristbands with wave numbers for 2,200 runners.',
   '/gallery/southern-cross-wristbands.jpg', 'Southern Cross Marathon',
   '["wristbands","marathon","colour"]', false, 20),

  -- MTB Boards
  ('mtb-boards', 'Queenstown Enduro Series Boards',
   'Corflute number boards across 5 rounds, weatherproof in alpine conditions.',
   '/gallery/queenstown-enduro-boards.jpg', 'Queenstown MTB Club',
   '["mtb","corflute","enduro"]', true, 10),
  ('mtb-boards', 'Rotorua Downhill Champs',
   'PVC number boards with custom numbering and sponsor strip.',
   '/gallery/rotorua-downhill-champs.jpg', 'Rotorua Downhill',
   '["mtb","pvc","dh"]', false, 20),

  -- Stamps
  ('stamps', 'The Butcher & Baker Co.',
   'Self-inking stamp with dual-line logo mark for daily paper use.',
   '/gallery/butcher-baker-stamp.jpg', 'Butcher & Baker',
   '["stamp","retail","logo"]', true, 10),
  ('stamps', 'Aroha Yoga Collective',
   'Self-inking stamp with single-line identity mark.',
   '/gallery/aroha-yoga-stamp.jpg', 'Aroha Yoga',
   '["stamp","wellness","mark"]', false, 20),

  -- Trophies
  ('trophies', 'NZ Craft Beer Awards Plaques',
   'Laser-engraved clear acrylic plaques — 48 category winners.',
   '/gallery/craft-beer-awards-plaques.jpg', 'NZ Craft Beer Awards',
   '["plaque","acrylic","awards"]', true, 10),
  ('trophies', 'Startup Weekend Winner Trophy',
   'Laser-cut plywood trophy with engraved team name.',
   '/gallery/startup-weekend-trophy.jpg', 'Startup Weekend',
   '["trophy","plywood","startup"]', false, 20),

  -- Laser-Cut
  ('laser-cut', 'Lantern Festival Signage',
   'Laser-cut plywood signage for wayfinding across the festival grounds.',
   '/gallery/lantern-festival-signage.jpg', 'Lantern Festival',
   '["signage","plywood","event"]', true, 10),
  ('laser-cut', 'Matariki Ornament Series',
   'Limited-edition acrylic ornaments celebrating the Matariki star cluster.',
   '/gallery/matariki-ornaments.jpg', 'Matariki Trust',
   '["ornament","acrylic","matariki"]', false, 20)
) as g(division_slug, title, description, image_url, customer_name, tags, featured, sort_order)
  on d.slug = g.division_slug
on conflict (division_id, title) do update
  set description   = excluded.description,
      image_url     = excluded.image_url,
      customer_name = excluded.customer_name,
      tags          = excluded.tags,
      featured      = excluded.featured,
      sort_order    = excluded.sort_order,
      active        = true;