-- Smart Expense AI: initial schema
-- Run in the Supabase SQL editor, or with `supabase db push`.
-- Requires PostgreSQL 15+ (Supabase default).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.transaction_type as enum ('income', 'expense', 'transfer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.category_type as enum ('income', 'expense');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ocr_status as enum ('pending', 'success', 'needs_review', 'failed', 'not_configured');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.transaction_source as enum ('manual', 'ocr', 'import');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles  (the "users" table of the brief; auth itself lives in auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  currency char(3) not null default 'THB',
  -- names on the user's own bank accounts, used to tell income from expense on slips
  account_names text[] not null default '{}',
  keep_receipt_images boolean not null default true,
  ocr_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  type public.category_type not null,
  icon text not null default 'circle',
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_default boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  unique (user_id, type, name),
  unique (id, user_id)
);

create index if not exists categories_user_idx on public.categories (user_id);

-- ---------------------------------------------------------------------------
-- receipts (uploaded slip images + OCR output)
-- ---------------------------------------------------------------------------
create table if not exists public.receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text,                      -- null after the image is deleted
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size int not null check (file_size > 0 and file_size <= 5242880),
  file_hash text not null,                -- sha256 of the original file
  ocr_status public.ocr_status not null default 'pending',
  ocr_provider text,
  raw_text text,
  extracted_data jsonb,
  confidence_score numeric(4, 3) check (confidence_score between 0 and 1),
  error_message text,
  created_at timestamptz not null default now(),
  unique (id, user_id)
);

create index if not exists receipts_user_created_idx on public.receipts (user_id, created_at desc);
create index if not exists receipts_user_hash_idx on public.receipts (user_id, file_hash);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.transaction_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  currency char(3) not null default 'THB',
  category_id uuid,
  merchant_name text check (char_length(merchant_name) <= 120),
  transaction_date date not null,
  transaction_time time,
  payment_method text check (char_length(payment_method) <= 40),
  bank text check (char_length(bank) <= 60),
  sender_name text check (char_length(sender_name) <= 120),
  receiver_name text check (char_length(receiver_name) <= 120),
  reference_number text check (char_length(reference_number) <= 64),
  source public.transaction_source not null default 'manual',
  receipt_id uuid,
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- a category / receipt must belong to the same user
  foreign key (category_id, user_id) references public.categories (id, user_id)
    on delete set null (category_id),
  foreign key (receipt_id, user_id) references public.receipts (id, user_id)
    on delete set null (receipt_id),
  -- transfers between own accounts have no category
  check (type <> 'transfer' or category_id is null)
);

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

create index if not exists transactions_user_date_idx on public.transactions (user_id, transaction_date desc, created_at desc);
create index if not exists transactions_user_category_idx on public.transactions (user_id, category_id);

-- Hard dedup: the same bank reference number with the same amount is the same transaction.
-- Softer checks (same amount + date + time/merchant) are done in the app and shown as a warning.
create unique index if not exists transactions_user_ref_amount_uq
  on public.transactions (user_id, reference_number, amount)
  where reference_number is not null;

-- ---------------------------------------------------------------------------
-- budgets (category_id null = overall budget)
-- ---------------------------------------------------------------------------
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  period_start date not null,
  period_end date not null,
  alert_threshold numeric(5, 2) not null default 80 check (alert_threshold > 0 and alert_threshold <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end >= period_start),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

create trigger budgets_updated_at before update on public.budgets
  for each row execute function public.set_updated_at();

create unique index if not exists budgets_user_cat_period_uq
  on public.budgets (user_id, category_id, period_start, period_end) nulls not distinct;
create index if not exists budgets_user_period_idx on public.budgets (user_id, period_start, period_end);

-- ---------------------------------------------------------------------------
-- merchant_rules (learned "this merchant -> this category")
-- ---------------------------------------------------------------------------
create table if not exists public.merchant_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  merchant_pattern text not null check (char_length(merchant_pattern) between 1 and 120),
  category_id uuid not null,
  hit_count int not null default 1,
  updated_at timestamptz not null default now(),
  unique (user_id, merchant_pattern),
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- notification_settings
-- ---------------------------------------------------------------------------
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  budget_alert_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: every row is visible / writable only by its owner
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.receipts enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;
alter table public.merchant_rules enable row level security;
alter table public.notification_settings enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own categories" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own receipts" on public.receipts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own transactions" on public.transactions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own budgets" on public.budgets
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own merchant rules" on public.merchant_rules
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own notification settings" on public.notification_settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- New user bootstrap: profile + default categories + notification settings
-- ---------------------------------------------------------------------------
create or replace function public.seed_default_categories(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order)
  values
    (p_user, 'อาหารและเครื่องดื่ม', 'expense', 'utensils', '#F97316', true, 1),
    (p_user, 'เดินทาง', 'expense', 'car', '#0EA5E9', true, 2),
    (p_user, 'ช้อปปิ้ง', 'expense', 'shopping-bag', '#EC4899', true, 3),
    (p_user, 'บ้านและที่อยู่อาศัย', 'expense', 'home', '#8B5CF6', true, 4),
    (p_user, 'ค่าน้ำ ค่าไฟ อินเทอร์เน็ต', 'expense', 'zap', '#EAB308', true, 5),
    (p_user, 'สุขภาพ', 'expense', 'heart-pulse', '#EF4444', true, 6),
    (p_user, 'การศึกษา', 'expense', 'graduation-cap', '#6366F1', true, 7),
    (p_user, 'ความบันเทิง', 'expense', 'clapperboard', '#14B8A6', true, 8),
    (p_user, 'ผ่อนชำระและหนี้สิน', 'expense', 'credit-card', '#B91C1C', true, 9),
    (p_user, 'อื่น ๆ', 'expense', 'circle', '#64748B', true, 99),
    (p_user, 'เงินเดือน', 'income', 'wallet', '#16A34A', true, 1),
    (p_user, 'รายได้เสริม', 'income', 'sparkles', '#22C55E', true, 2),
    (p_user, 'ค่าคอมมิชชัน', 'income', 'percent', '#10B981', true, 3),
    (p_user, 'รายได้ธุรกิจ', 'income', 'briefcase', '#059669', true, 4),
    (p_user, 'เงินคืน', 'income', 'rotate-ccw', '#84CC16', true, 5),
    (p_user, 'อื่น ๆ', 'income', 'circle', '#64748B', true, 99)
  on conflict (user_id, type, name) do nothing;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''))
    on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  insert into public.notification_settings (user_id) values (new.id)
    on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- seed_default_categories is only for the trigger; regular users must not call it for others
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for slip images, path = <user_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "receipts: owner can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipts: owner can upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "receipts: owner can delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
