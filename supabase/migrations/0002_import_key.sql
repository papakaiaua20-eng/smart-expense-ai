-- Imported rows remember where they came from so importing the same backup twice adds nothing.
alter table public.transactions add column if not exists import_key text check (char_length(import_key) <= 120);
alter table public.transactions drop constraint if exists transactions_user_import_key_uq;
alter table public.transactions add constraint transactions_user_import_key_uq unique (user_id, import_key);
