-- ============================================================================
-- Digital Heroes — Initial Schema (Phase 1, revision 2)
-- Enums · Tables · Indexes · Triggers · RLS · Storage Buckets
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role           as enum ('customer', 'admin');
create type public.order_status        as enum ('quote', 'order', 'artwork', 'proof', 'production', 'completed', 'cancelled');
create type public.proof_status        as enum ('pending', 'approved', 'rejected', 'superseded');
create type public.proof_action        as enum ('uploaded', 'approved', 'rejected', 'change_requested');
create type public.print_job_status    as enum ('pending', 'processing', 'ready', 'failed');
create type public.print_job_file_type as enum ('pdf', 'png', 'zip');

-- ----------------------------------------------------------------------------
-- Shared trigger utilities
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Order number sequence + generator
-- ----------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start with 1 increment by 1;

create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  next_val bigint;
begin
  select nextval('public.order_number_seq') into next_val;
  return 'DH-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 5, '0');
end;
$$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles (extends auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null,
  full_name       text not null default '',
  role            public.user_role not null default 'customer',
  company_name    text,
  phone           text,
  xero_contact_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index profiles_role_idx  on public.profiles(role);
create index profiles_email_idx on public.profiles(lower(email));

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- is_admin() helper — used across RLS policies
-- ----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;


-- Prevent non-admins from escalating their own role.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins may change user roles';
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_role
  before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ----------------------------------------------------------------------------
-- divisions
-- ----------------------------------------------------------------------------
create table public.divisions (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  tagline        text not null default '',
  description    text not null default '',
  accent_color   text not null default '#E85D04',
  hero_image_url text,
  sort_order     int  not null default 0,
  active         boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index divisions_sort_idx on public.divisions(sort_order, active);

create trigger trg_divisions_updated_at
  before update on public.divisions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- products (parameter-driven — no SKU bloat)
-- ----------------------------------------------------------------------------
create table public.products (
  id                     uuid primary key default gen_random_uuid(),
  division_id            uuid not null references public.divisions(id) on delete cascade,
  slug                   text not null,
  name                   text not null,
  description            text not null default '',
  base_price_cents       int  not null check (base_price_cents >= 0),
  min_width_mm           numeric(8,2) not null check (min_width_mm  > 0),
  max_width_mm           numeric(8,2) not null check (max_width_mm  > 0),
  min_height_mm          numeric(8,2) not null check (min_height_mm > 0),
  max_height_mm          numeric(8,2) not null check (max_height_mm > 0),
  allowed_materials      jsonb not null default '[]'::jsonb,
  allowed_orientations   jsonb not null default '["landscape","portrait"]'::jsonb,
  bleed_mm               numeric(5,2) not null default 0   check (bleed_mm       >= 0),
  safe_margin_mm         numeric(5,2) not null default 2   check (safe_margin_mm >= 0),
  target_dpi             int  not null default 300 check (target_dpi between 72 and 1200),
  vat_percent            numeric(5,2) not null default 15.00 check (vat_percent >= 0 and vat_percent <= 100),
  volume_discount_tiers  jsonb not null default '[]'::jsonb,
  template_fit_rules     jsonb not null default
    '{"mode":"shrink","min_font_size":6,"max_font_size":120,"letter_spacing_min":-2,"letter_spacing_max":8}'::jsonb,
  turnaround_days        int  not null default 5 check (turnaround_days > 0),
  xero_account_code      text not null default '200',
  active                 boolean not null default true,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (max_width_mm  >= min_width_mm),
  check (max_height_mm >= min_height_mm),
  unique (division_id, slug)
);

create index products_division_idx on public.products(division_id);
create index products_active_idx   on public.products(active);

create trigger trg_products_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- templates (print-area bounds per product)
-- ----------------------------------------------------------------------------
create table public.templates (
  id                      uuid primary key default gen_random_uuid(),
  product_id              uuid not null references public.products(id) on delete cascade,
  name                    text not null,
  preview_url             text,
  canvas_width_px         int  not null check (canvas_width_px  > 0),
  canvas_height_px        int  not null check (canvas_height_px > 0),
  print_area              jsonb not null,
  placeholder_definitions jsonb not null default '[]'::jsonb,
  background_url          text,
  active                  boolean not null default true,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (product_id, name)
);

create index templates_product_idx on public.templates(product_id);
create index templates_active_idx  on public.templates(active);

create trigger trg_templates_updated_at
  before update on public.templates
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- designs (customer saved designs) — added template_id + config_snapshot
-- ----------------------------------------------------------------------------
create table public.designs (
  id                    uuid primary key default gen_random_uuid(),
  customer_id           uuid not null references public.profiles(id) on delete cascade,
  product_id            uuid not null references public.products(id) on delete restrict,
  template_id           uuid references public.templates(id) on delete set null,
  name                  text not null default 'Untitled design',
  canvas_json           jsonb not null default '{}'::jsonb,
  config_snapshot       jsonb not null default '{}'::jsonb,
  thumbnail_url         text,
  artwork_source        text not null default 'canvas' check (artwork_source in ('canvas', 'upload')),
  uploaded_artwork_url  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index designs_customer_idx on public.designs(customer_id);
create index designs_product_idx  on public.designs(product_id);
create index designs_template_idx on public.designs(template_id);

create trigger trg_designs_updated_at
  before update on public.designs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- orders — added xero_invoice_id + xero_exported_at
-- ----------------------------------------------------------------------------
create table public.orders (
  id                       uuid primary key default gen_random_uuid(),
  order_number             text not null unique default public.generate_order_number(),
  customer_id              uuid not null references public.profiles(id) on delete restrict,
  status                   public.order_status not null default 'quote',
  currency                 text not null default 'NZD',
  subtotal_cents           int  not null default 0 check (subtotal_cents  >= 0),
  discount_cents           int  not null default 0 check (discount_cents  >= 0),
  vat_cents                int  not null default 0 check (vat_cents       >= 0),
  total_cents              int  not null default 0 check (total_cents     >= 0),
  stripe_session_id        text,
  stripe_payment_intent_id text,
  paid_at                  timestamptz,
  shipping_address         jsonb,
  notes                    text,
  xero_invoice_id          text,
  xero_exported_at         timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index orders_customer_idx       on public.orders(customer_id);
create index orders_status_idx         on public.orders(status);
create index orders_created_at_idx     on public.orders(created_at desc);
create index orders_stripe_session_idx on public.orders(stripe_session_id);
create index orders_xero_exported_idx  on public.orders(xero_exported_at);

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- order_items
-- ----------------------------------------------------------------------------
create table public.order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references public.orders(id) on delete cascade,
  product_id         uuid not null references public.products(id) on delete restrict,
  design_id          uuid references public.designs(id) on delete set null,
  quantity           int  not null check (quantity > 0),
  width_mm           numeric(8,2) not null check (width_mm  > 0),
  height_mm          numeric(8,2) not null check (height_mm > 0),
  material           text,
  orientation        text check (orientation in ('landscape','portrait')),
  unit_price_cents   int  not null check (unit_price_cents  >= 0),
  line_total_cents   int  not null check (line_total_cents  >= 0),
  spec_snapshot      jsonb not null default '{}'::jsonb,
  artwork_file_url   text,
  csv_merge_file_url text,
  production_status  public.order_status not null default 'order',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index order_items_order_idx   on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id);
create index order_items_design_idx  on public.order_items(design_id);

create trigger trg_order_items_updated_at
  before update on public.order_items
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- proofs (versioned, immutable approval trail)
-- ----------------------------------------------------------------------------
create table public.proofs (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  version       int  not null check (version >= 1),
  file_url      text not null,
  thumbnail_url text,
  status        public.proof_status not null default 'pending',
  uploaded_by   uuid references public.profiles(id) on delete set null,
  approved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (order_item_id, version)
);

create index proofs_item_idx   on public.proofs(order_item_id);
create index proofs_status_idx on public.proofs(status);

create trigger trg_proofs_updated_at
  before update on public.proofs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- proof_logs (immutable) — created before any function that inserts into it
-- ----------------------------------------------------------------------------
create table public.proof_logs (
  id         uuid primary key default gen_random_uuid(),
  proof_id   uuid not null references public.proofs(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete set null,
  action     public.proof_action not null,
  notes      text,
  created_at timestamptz not null default now()
);

create index proof_logs_proof_idx   on public.proof_logs(proof_id);
create index proof_logs_created_idx on public.proof_logs(created_at desc);
create index proof_logs_action_idx  on public.proof_logs(action);

-- ----------------------------------------------------------------------------
-- Proof state machine
-- ----------------------------------------------------------------------------

-- BEFORE INSERT: supersede any other pending proof for the same item.
create or replace function public.supersede_pending_proofs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.proofs
     set status = 'superseded'
   where order_item_id = new.order_item_id
     and status        = 'pending';
  return new;
end;
$$;

create trigger trg_supersede_pending_proofs
  before insert on public.proofs
  for each row execute function public.supersede_pending_proofs();

-- BEFORE UPDATE: only latest version may be approved/rejected; stamp approved_at.
create or replace function public.enforce_proof_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_version int;
begin
  if new.status is distinct from old.status
     and new.status in ('approved', 'rejected')
     and old.status = 'pending' then

    select max(version) into latest_version
      from public.proofs
     where order_item_id = new.order_item_id;

    if new.version <> latest_version then
      raise exception 'Only the latest proof version can be approved or rejected';
    end if;

    if new.status = 'approved' then
      new.approved_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_enforce_proof_decision
  before update on public.proofs
  for each row execute function public.enforce_proof_decision();

-- AFTER INSERT: log the 'uploaded' event. Approve / reject / change_request
-- log entries are written explicitly by /api/proofs/[proofId]/decision
-- (with a server-verified user_id and free-text notes).
create or replace function public.log_proof_uploaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.proof_logs (proof_id, user_id, action, notes)
  values (new.id, auth.uid(), 'uploaded', null);
  return new;
end;
$$;

create trigger trg_log_proof_uploaded
  after insert on public.proofs
  for each row execute function public.log_proof_uploaded();

-- ----------------------------------------------------------------------------
-- print_jobs (admin-only production artifacts)
-- ----------------------------------------------------------------------------
create table public.print_jobs (
  id            uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  proof_id      uuid not null references public.proofs(id) on delete restrict,
  file_type     public.print_job_file_type not null,
  file_url      text,
  status        public.print_job_status not null default 'pending',
  generated_by  uuid references public.profiles(id) on delete set null,
  generated_at  timestamptz,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index print_jobs_item_idx   on public.print_jobs(order_item_id);
create index print_jobs_status_idx on public.print_jobs(status);
create index print_jobs_proof_idx  on public.print_jobs(proof_id);

create trigger trg_print_jobs_updated_at
  before update on public.print_jobs
  for each row execute function public.set_updated_at();

-- Hard approval gate: refuse to create a print job unless the referenced
-- proof is APPROVED. Defence in depth — the API layer also checks this.
create or replace function public.enforce_approved_proof_for_print_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  proof_status public.proof_status;
begin
  select status into proof_status
    from public.proofs
   where id = new.proof_id;

  if proof_status is null then
    raise exception 'Cannot create print job: proof % not found', new.proof_id;
  end if;

  if proof_status <> 'approved' then
    raise exception 'Cannot create print job: proof % is not approved (status: %)',
      new.proof_id, proof_status;
  end if;

  return new;
end;
$$;

create trigger trg_enforce_approved_proof_for_print_job
  before insert on public.print_jobs
  for each row execute function public.enforce_approved_proof_for_print_job();

-- ----------------------------------------------------------------------------
-- gallery_items (public live work gallery)
-- ----------------------------------------------------------------------------
create table public.gallery_items (
  id            uuid primary key default gen_random_uuid(),
  division_id   uuid not null references public.divisions(id) on delete cascade,
  title         text not null,
  description   text not null default '',
  image_url     text not null,
  customer_name text,
  tags          jsonb not null default '[]'::jsonb,
  featured      boolean not null default false,
  sort_order    int  not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (division_id, title)
);

create index gallery_division_idx on public.gallery_items(division_id);
create index gallery_featured_idx on public.gallery_items(featured, sort_order);

create trigger trg_gallery_items_updated_at
  before update on public.gallery_items
  for each row execute function public.set_updated_at();

-- ============================================================================
-- AUTO-PROVISION PROFILE ON SIGNUP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'customer'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.divisions     enable row level security;
alter table public.products      enable row level security;
alter table public.templates     enable row level security;
alter table public.designs       enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.proofs        enable row level security;
alter table public.proof_logs    enable row level security;
alter table public.print_jobs    enable row level security;
alter table public.gallery_items enable row level security;

-- ------------------------------- profiles ----------------------------------
create policy "profiles_select_self_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ------------------------------- divisions ---------------------------------
create policy "divisions_public_read"
  on public.divisions for select
  using (active = true or public.is_admin());

create policy "divisions_admin_write"
  on public.divisions for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------- products ----------------------------------
create policy "products_public_read"
  on public.products for select
  using (active = true or public.is_admin());

create policy "products_admin_write"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------- templates ---------------------------------
create policy "templates_public_read"
  on public.templates for select
  using (active = true or public.is_admin());

create policy "templates_admin_write"
  on public.templates for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------- designs -----------------------------------
create policy "designs_select_owner_or_admin"
  on public.designs for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "designs_insert_owner"
  on public.designs for insert
  with check (customer_id = auth.uid());

create policy "designs_update_owner_or_admin"
  on public.designs for update
  using (customer_id = auth.uid() or public.is_admin())
  with check (customer_id = auth.uid() or public.is_admin());

create policy "designs_delete_owner_or_admin"
  on public.designs for delete
  using (customer_id = auth.uid() or public.is_admin());

-- ------------------------------- orders ------------------------------------
-- Customers: SELECT only. All order writes go through server route handlers
-- using the service-role key (bypasses RLS after server-side validation).
create policy "orders_select_owner_or_admin"
  on public.orders for select
  using (customer_id = auth.uid() or public.is_admin());

create policy "orders_admin_write"
  on public.orders for all
  using (public.is_admin())
  with check (public.is_admin());

-- ----------------------------- order_items ---------------------------------
-- Customers: SELECT only. Server routes write with service role.
create policy "order_items_select_owner_or_admin"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.customer_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "order_items_admin_write"
  on public.order_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ------------------------------- proofs ------------------------------------
create policy "proofs_select_owner_or_admin"
  on public.proofs for select
  using (
    exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and o.customer_id = auth.uid()
    )
    or public.is_admin()
  );

create policy "proofs_insert_admin"
  on public.proofs for insert
  with check (public.is_admin());

-- Customers may only transition pending → approved/rejected on their own items.
create policy "proofs_update_customer_decision"
  on public.proofs for update
  using (
    status = 'pending'
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and o.customer_id = auth.uid()
    )
  )
  with check (
    status in ('approved', 'rejected')
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id = order_item_id and o.customer_id = auth.uid()
    )
  );

create policy "proofs_update_admin"
  on public.proofs for update
  using (public.is_admin()) with check (public.is_admin());

create policy "proofs_delete_admin"
  on public.proofs for delete
  using (public.is_admin());

-- ----------------------------- proof_logs ----------------------------------
create policy "proof_logs_select_owner_or_admin"
  on public.proof_logs for select
  using (
    exists (
      select 1 from public.proofs p
      join public.order_items oi on oi.id = p.order_item_id
      join public.orders o       on o.id  = oi.order_id
      where p.id = proof_id and o.customer_id = auth.uid()
    )
    or public.is_admin()
  );

-- Customer-authored change-request notes are the only customer-side insert.
create policy "proof_logs_insert_customer_change_request"
  on public.proof_logs for insert
  with check (
    user_id = auth.uid()
    and action = 'change_requested'
    and exists (
      select 1 from public.proofs p
      join public.order_items oi on oi.id = p.order_item_id
      join public.orders o       on o.id  = oi.order_id
      where p.id = proof_id and o.customer_id = auth.uid()
    )
  );

create policy "proof_logs_insert_admin"
  on public.proof_logs for insert
  with check (public.is_admin());

-- No update / delete policies — proof_logs are immutable by omission.

-- ----------------------------- print_jobs ----------------------------------
create policy "print_jobs_admin_all"
  on public.print_jobs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------- gallery_items --------------------------------
create policy "gallery_public_read"
  on public.gallery_items for select
  using (active = true or public.is_admin());

create policy "gallery_admin_write"
  on public.gallery_items for all
  using (public.is_admin())
  with check (public.is_admin());

-- ============================================================================
-- STORAGE
-- ============================================================================
insert into storage.buckets (id, name, public)
values
  ('customer-artworks', 'customer-artworks', false),
  ('proofs',            'proofs',            false),
  ('print-jobs',        'print-jobs',        false),
  ('gallery',           'gallery',           true)
on conflict (id) do nothing;

-- --------------------------- customer-artworks -----------------------------
-- Convention: {user_id}/{design_id}/{filename}

create policy "artworks_customer_select"
  on storage.objects for select
  using (
    bucket_id = 'customer-artworks'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "artworks_customer_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'customer-artworks'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "artworks_customer_update"
  on storage.objects for update
  using (
    bucket_id = 'customer-artworks'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

create policy "artworks_customer_delete"
  on storage.objects for delete
  using (
    bucket_id = 'customer-artworks'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ------------------------------- proofs ------------------------------------
-- Convention: {order_item_id}/v{n}.pdf

create policy "proofs_admin_all"
  on storage.objects for all
  using (bucket_id = 'proofs' and public.is_admin())
  with check (bucket_id = 'proofs' and public.is_admin());

create policy "proofs_customer_read"
  on storage.objects for select
  using (
    bucket_id = 'proofs'
    and exists (
      select 1 from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.id::text = (storage.foldername(name))[1]
        and o.customer_id = auth.uid()
    )
  );

-- ------------------------------ print-jobs ---------------------------------
-- Admin-only. Production files must never be readable by customers.

create policy "print_jobs_admin_all"
  on storage.objects for all
  using (bucket_id = 'print-jobs' and public.is_admin())
  with check (bucket_id = 'print-jobs' and public.is_admin());

-- -------------------------------- gallery ----------------------------------
create policy "gallery_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'gallery');

create policy "gallery_storage_admin_insert"
  on storage.objects for insert
  with check (bucket_id = 'gallery' and public.is_admin());

create policy "gallery_storage_admin_update"
  on storage.objects for update
  using (bucket_id = 'gallery' and public.is_admin());

create policy "gallery_storage_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'gallery' and public.is_admin());