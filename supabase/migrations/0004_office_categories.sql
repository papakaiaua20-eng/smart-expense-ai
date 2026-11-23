-- Office categories: replace the personal-finance defaults with an office / online-shop set.
-- Safe to run more than once. Existing transactions, budgets and learned rules are moved to the
-- matching new category; old default categories are removed only when nothing uses them anymore.

create or replace function public.seed_default_categories(p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.categories (user_id, name, type, icon, color, is_default, sort_order)
  values
    (p_user, 'ซื้อสินค้า/วัตถุดิบ', 'expense', 'package', '#2563EB', true, 1),
    (p_user, 'ค่าขนส่ง/ค่าส่งของ', 'expense', 'truck', '#0EA5E9', true, 2),
    (p_user, 'บรรจุภัณฑ์', 'expense', 'box', '#A16207', true, 3),
    (p_user, 'ค่าธรรมเนียมแพลตฟอร์ม', 'expense', 'store', '#DB2777', true, 4),
    (p_user, 'ค่าโฆษณา/การตลาด', 'expense', 'megaphone', '#F97316', true, 5),
    (p_user, 'เงินเดือน/ค่าจ้าง/คอมมิชชัน', 'expense', 'users', '#7C3AED', true, 6),
    (p_user, 'ค่าเช่าสำนักงาน/โกดัง', 'expense', 'building', '#8B5CF6', true, 7),
    (p_user, 'ค่าน้ำ ค่าไฟ', 'expense', 'zap', '#EAB308', true, 8),
    (p_user, 'ค่าอินเทอร์เน็ต/โทรศัพท์', 'expense', 'wifi', '#06B6D4', true, 9),
    (p_user, 'อุปกรณ์สำนักงาน/เครื่องเขียน', 'expense', 'pencil', '#14B8A6', true, 10),
    (p_user, 'ซอฟต์แวร์/บริการออนไลน์', 'expense', 'monitor', '#6366F1', true, 11),
    (p_user, 'ซ่อมบำรุง', 'expense', 'wrench', '#78716C', true, 12),
    (p_user, 'ค่าเดินทาง/น้ำมัน', 'expense', 'car', '#0284C7', true, 13),
    (p_user, 'อาหาร/รับรองลูกค้า', 'expense', 'utensils', '#EA580C', true, 14),
    (p_user, 'ภาษี/ค่าธรรมเนียมราชการ', 'expense', 'landmark', '#B91C1C', true, 15),
    (p_user, 'ค่าธรรมเนียมธนาคาร', 'expense', 'credit-card', '#BE123C', true, 16),
    (p_user, 'อื่น ๆ', 'expense', 'circle', '#64748B', true, 99),
    (p_user, 'ยอดขายสินค้า', 'income', 'shopping-bag', '#16A34A', true, 1),
    (p_user, 'รายได้ค่าบริการ', 'income', 'briefcase', '#059669', true, 2),
    (p_user, 'เงินโอนจากแพลตฟอร์ม', 'income', 'wallet', '#22C55E', true, 3),
    (p_user, 'ดอกเบี้ย/รายได้อื่น', 'income', 'piggy-bank', '#84CC16', true, 4),
    (p_user, 'เงินลงทุน/เงินทุนเพิ่ม', 'income', 'trending-up', '#10B981', true, 5),
    (p_user, 'อื่น ๆ', 'income', 'circle', '#64748B', true, 99)
  on conflict (user_id, type, name) do update
    set is_default = true, sort_order = excluded.sort_order, icon = excluded.icon, color = excluded.color;
$$;
revoke execute on function public.seed_default_categories(uuid) from public, anon, authenticated;

-- old category name -> new category name (old personal defaults + บัญชีออฟฟิศ import names)
drop table if exists _cat_map, _cat_move;
create temporary table _cat_map (type public.category_type, old_name text, new_name text);
insert into _cat_map values
  ('expense', 'อาหารและเครื่องดื่ม', 'อาหาร/รับรองลูกค้า'),
  ('expense', 'เดินทาง', 'ค่าเดินทาง/น้ำมัน'),
  ('expense', 'ช้อปปิ้ง', 'ซื้อสินค้า/วัตถุดิบ'),
  ('expense', 'บ้านและที่อยู่อาศัย', 'ค่าเช่าสำนักงาน/โกดัง'),
  ('expense', 'ค่าน้ำ ค่าไฟ อินเทอร์เน็ต', 'ค่าน้ำ ค่าไฟ'),
  ('expense', 'สุขภาพ', 'อื่น ๆ'),
  ('expense', 'การศึกษา', 'อื่น ๆ'),
  ('expense', 'ความบันเทิง', 'อื่น ๆ'),
  ('expense', 'ผ่อนชำระและหนี้สิน', 'อื่น ๆ'),
  ('expense', 'สั่งของ / วัสดุสำนักงาน', 'อุปกรณ์สำนักงาน/เครื่องเขียน'),
  ('expense', 'ซ่อมบำรุง / ทำความสะอาด', 'ซ่อมบำรุง'),
  ('expense', 'ค่าอินเทอร์เน็ต / โทรศัพท์', 'ค่าอินเทอร์เน็ต/โทรศัพท์'),
  ('income', 'เงินเดือน', 'ดอกเบี้ย/รายได้อื่น'),
  ('income', 'รายได้เสริม', 'ดอกเบี้ย/รายได้อื่น'),
  ('income', 'ค่าคอมมิชชัน', 'รายได้ค่าบริการ'),
  ('income', 'รายได้ธุรกิจ', 'ยอดขายสินค้า'),
  ('income', 'เงินคืน', 'ดอกเบี้ย/รายได้อื่น');

-- 1) give every existing user the new set
select public.seed_default_categories(id) from auth.users;

-- 2) move data from old categories to the new ones
create temporary table _cat_move as
select o.id as old_id, n.id as new_id, o.user_id
from public.categories o
join _cat_map m on m.type = o.type and m.old_name = o.name
join public.categories n on n.user_id = o.user_id and n.type = m.type and n.name = m.new_name;

update public.transactions t set category_id = mv.new_id
from _cat_move mv where t.category_id = mv.old_id;

update public.merchant_rules r set category_id = mv.new_id
from _cat_move mv where r.category_id = mv.old_id;

-- (two old categories can map to the same new one: move only one budget per category + period)
update public.budgets b set category_id = mv.new_id
from _cat_move mv
where b.category_id = mv.old_id
  and b.id in (
    select id from (
      select b2.id, row_number() over (
        partition by b2.user_id, mv2.new_id, b2.period_start, b2.period_end order by b2.id) as rn
      from public.budgets b2 join _cat_move mv2 on b2.category_id = mv2.old_id) s
    where rn = 1)
  and not exists (
    select 1 from public.budgets x
    where x.user_id = b.user_id and x.category_id = mv.new_id
      and x.period_start = b.period_start and x.period_end = b.period_end);

-- 3) remove old categories nobody uses anymore; keep (as custom) any that still hold a budget
delete from public.categories c
using _cat_move mv
where c.id = mv.old_id
  and not exists (select 1 from public.transactions t where t.category_id = c.id)
  and not exists (select 1 from public.budgets b where b.category_id = c.id);

update public.categories c set is_default = false
where is_default
  and not exists (
    select 1 from (values
      ('expense'::public.category_type, 'ซื้อสินค้า/วัตถุดิบ'), ('expense', 'ค่าขนส่ง/ค่าส่งของ'), ('expense', 'บรรจุภัณฑ์'),
      ('expense', 'ค่าธรรมเนียมแพลตฟอร์ม'), ('expense', 'ค่าโฆษณา/การตลาด'), ('expense', 'เงินเดือน/ค่าจ้าง/คอมมิชชัน'),
      ('expense', 'ค่าเช่าสำนักงาน/โกดัง'), ('expense', 'ค่าน้ำ ค่าไฟ'), ('expense', 'ค่าอินเทอร์เน็ต/โทรศัพท์'),
      ('expense', 'อุปกรณ์สำนักงาน/เครื่องเขียน'), ('expense', 'ซอฟต์แวร์/บริการออนไลน์'), ('expense', 'ซ่อมบำรุง'),
      ('expense', 'ค่าเดินทาง/น้ำมัน'), ('expense', 'อาหาร/รับรองลูกค้า'), ('expense', 'ภาษี/ค่าธรรมเนียมราชการ'),
      ('expense', 'ค่าธรรมเนียมธนาคาร'), ('expense', 'อื่น ๆ'),
      ('income', 'ยอดขายสินค้า'), ('income', 'รายได้ค่าบริการ'), ('income', 'เงินโอนจากแพลตฟอร์ม'),
      ('income', 'ดอกเบี้ย/รายได้อื่น'), ('income', 'เงินลงทุน/เงินทุนเพิ่ม'), ('income', 'อื่น ๆ')
    ) as d(type, name) where d.type = c.type and d.name = c.name);
drop table if exists _cat_map, _cat_move;
