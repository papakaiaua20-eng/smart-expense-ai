-- Run after supabase_stub.sql + migrations. Fails loudly if isolation breaks.
\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select, insert, delete on storage.objects to authenticated;

insert into auth.users values ('00000000-0000-0000-0000-00000000000a', 'a@example.com'),
                              ('00000000-0000-0000-0000-00000000000b', 'b@example.com');

do $$ begin
  assert (select count(*) from public.categories where user_id = '00000000-0000-0000-0000-00000000000a') = 16,
    'default categories seeded';
  assert (select count(*) from public.profiles) = 2, 'profiles created';
end $$;

-- act as user A
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

insert into public.transactions (user_id, type, amount, transaction_date, category_id, reference_number)
select auth.uid(), 'expense', 120.50, '2026-11-20', id, 'REF123456'
from public.categories where name = 'อาหารและเครื่องดื่ม' and type = 'expense';

do $$ begin
  assert (select count(*) from public.categories) = 16, 'A sees only own categories';
  assert (select count(*) from public.profiles) = 1, 'A sees only own profile';
end $$;

-- duplicate ref + amount must fail
do $$ begin
  begin
    insert into public.transactions (user_id, type, amount, transaction_date, reference_number)
    values (auth.uid(), 'expense', 120.50, '2026-11-20', 'REF123456');
    raise exception 'duplicate was allowed';
  exception when unique_violation then null;
  end;
end $$;

-- A cannot insert rows owned by B
do $$ begin
  begin
    insert into public.transactions (user_id, type, amount, transaction_date)
    values ('00000000-0000-0000-0000-00000000000b', 'expense', 1, '2026-11-20');
    raise exception 'cross-user insert allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- storage: A can upload in own folder only
insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-0000-0000-00000000000a/x.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('receipts', '00000000-0000-0000-0000-00000000000b/x.jpg');
    raise exception 'cross-user upload allowed';
  exception when insufficient_privilege then null;
  end;
end $$;

-- act as user B
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ declare a_cat uuid; begin
  assert (select count(*) from public.transactions) = 0, 'B cannot see A transactions';
  assert (select count(*) from storage.objects) = 0, 'B cannot see A files';
  update public.transactions set amount = 1;
  delete from public.transactions;
end $$;

-- B cannot attach A's category to own transaction (composite FK)
reset role;
do $$ declare a_cat uuid; begin
  select id into a_cat from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' limit 1;
  begin
    insert into public.transactions (user_id, type, amount, transaction_date, category_id)
    values ('00000000-0000-0000-0000-00000000000b', 'expense', 5, '2026-11-20', a_cat);
    raise exception 'foreign category allowed';
  exception when foreign_key_violation then null;
  end;
  assert (select amount from public.transactions limit 1) = 120.50, 'B update/delete had no effect';
end $$;

-- deleting a category keeps the transaction, clears category
delete from public.categories where user_id = '00000000-0000-0000-0000-00000000000a' and name = 'อาหารและเครื่องดื่ม';
do $$ begin
  assert (select category_id from public.transactions limit 1) is null, 'category set null';
  assert (select user_id from public.transactions limit 1) is not null, 'user kept';
end $$;

-- budgets: overall budget unique per period
insert into public.budgets (user_id, amount, period_start, period_end)
values ('00000000-0000-0000-0000-00000000000a', 10000, '2026-11-01', '2026-11-30');
do $$ begin
  begin
    insert into public.budgets (user_id, amount, period_start, period_end)
    values ('00000000-0000-0000-0000-00000000000a', 5000, '2026-11-01', '2026-11-30');
    raise exception 'duplicate overall budget allowed';
  exception when unique_violation then null;
  end;
end $$;

select 'ALL RLS TESTS PASSED' as result;
