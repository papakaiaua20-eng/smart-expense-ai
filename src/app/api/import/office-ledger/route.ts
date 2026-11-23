import { ApiError, dbError, json, withUser } from "@/lib/api";
import { endOfMonth, startOfMonth, todayISO } from "@/lib/dates";
import { budgetCategoryName, officeBackup, prepareImport } from "@/lib/import/office-ledger";
import { getCategories } from "@/lib/server/data";

export const runtime = "nodejs";
export const maxDuration = 60;

const PALETTE = ["#B45309", "#0F766E", "#7C3AED", "#BE185D", "#0369A1", "#4D7C0F", "#9F1239", "#475569"];

// POST /api/import/office-ledger  body: backup JSON from "บัญชีออฟฟิศ"  (?dry_run=1 for a preview)
export const POST = withUser(async ({ req, supabase, user }) => {
  const text = await req.text();
  if (text.length > 15 * 1024 * 1024) throw new ApiError(413, "ไฟล์ใหญ่เกิน 15 MB");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, "อ่านไฟล์ไม่ได้ กรุณาเลือกไฟล์ .json ที่ได้จากปุ่มสำรองข้อมูล");
  }
  const parsed = officeBackup.safeParse(body);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message ?? "รูปแบบไฟล์ไม่ถูกต้อง");

  const { rows, skipped, categoryNames } = prepareImport(parsed.data.entries);
  const monthly = Object.entries(parsed.data.budgets?.monthly ?? {}).filter(([, v]) => v > 0);

  // which rows are already in the database (imported before)?
  const existing = new Set<string>();
  const keys = rows.map((r) => r.import_key);
  for (let i = 0; i < keys.length; i += 200) {
    const { data, error } = await supabase.from("transactions").select("import_key").in("import_key", keys.slice(i, i + 200));
    dbError(error);
    for (const d of data ?? []) existing.add(d.import_key as string);
  }
  const fresh = rows.filter((r) => !existing.has(r.import_key));

  const categories = await getCategories(supabase);
  const has = (type: string, name: string) => categories.some((c) => c.type === type && c.name === name);
  const newCats = categoryNames.filter((c) => !has(c.type, c.name));

  const dates = rows.map((r) => r.transaction_date).sort();
  const summary = {
    total_in_file: parsed.data.entries.length,
    to_import: fresh.length,
    already_imported: rows.length - fresh.length,
    skipped,
    new_categories: newCats.map((c) => c.name),
    date_from: dates[0] ?? null,
    date_to: dates[dates.length - 1] ?? null,
    income: Math.round(fresh.filter((r) => r.type === "income").reduce((a, r) => a + r.amount * 100, 0)) / 100,
    expense: Math.round(fresh.filter((r) => r.type === "expense").reduce((a, r) => a + r.amount * 100, 0)) / 100,
    budgets: monthly.length,
  };
  if (new URL(req.url).searchParams.get("dry_run")) return json({ dry_run: true, ...summary });

  // 1) create missing categories (kept by their original names)
  if (newCats.length) {
    const { error } = await supabase.from("categories").insert(
      newCats.map((c, i) => ({ user_id: user.id, name: c.name, type: c.type, color: PALETTE[i % PALETTE.length], icon: "tag", sort_order: 50 + i })),
    );
    if (error && error.code !== "23505") dbError(error);
  }
  const allCats = await getCategories(supabase);
  const catId = (type: string, name: string) =>
    allCats.find((c) => c.type === type && c.name === name)?.id ?? allCats.find((c) => c.type === type && c.name === "อื่น ๆ")?.id ?? null;

  // 2) insert transactions; the unique (user_id, import_key) makes a second import a no-op
  let inserted = 0;
  for (let i = 0; i < fresh.length; i += 500) {
    const chunk = fresh.slice(i, i + 500).map(({ categoryName, ...r }) => ({
      ...r,
      user_id: user.id,
      currency: "THB",
      source: "import",
      category_id: catId(r.type, categoryName),
    }));
    const { data, error } = await supabase
      .from("transactions")
      .upsert(chunk, { onConflict: "user_id,import_key", ignoreDuplicates: true })
      .select("id");
    dbError(error);
    inserted += data?.length ?? 0;
  }

  // 3) monthly budgets -> this month's budgets (only ones not set yet)
  let budgetsCreated = 0;
  if (monthly.length) {
    const t = todayISO();
    const budgetRows = monthly
      .map(([name, amount]) => {
        const catName = budgetCategoryName(name);
        const category_id = catName === null ? null : catId("expense", catName);
        if (catName !== null && !category_id) return null;
        return { user_id: user.id, category_id, amount: Math.round(amount * 100) / 100, period_start: startOfMonth(t), period_end: endOfMonth(t), alert_threshold: 80 };
      })
      .filter((b): b is NonNullable<typeof b> => !!b);
    const { data, error } = await supabase
      .from("budgets")
      .upsert(budgetRows, { onConflict: "user_id,category_id,period_start,period_end", ignoreDuplicates: true })
      .select("id");
    if (!error) budgetsCreated = data?.length ?? 0;
  }

  return json({ ...summary, imported: inserted, categories_created: newCats.length, budgets_created: budgetsCreated });
});
