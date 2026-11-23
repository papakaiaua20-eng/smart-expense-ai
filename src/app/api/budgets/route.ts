import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { endOfMonth, isValidISODate, startOfMonth, todayISO } from "@/lib/dates";
import { getCategories, getTxRows } from "@/lib/server/data";
import { budgetStatuses } from "@/lib/summary";
import type { Budget } from "@/lib/types";
import { budgetInput, zodMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

// GET /api/budgets?month=YYYY-MM  -> budgets active in that month with usage
export const GET = withUser(async ({ req, supabase }) => {
  const month = new URL(req.url).searchParams.get("month") ?? todayISO().slice(0, 7);
  const first = `${month}-01`;
  if (!isValidISODate(first)) throw new ApiError(400, "เดือนไม่ถูกต้อง");
  const from = startOfMonth(first);
  const to = endOfMonth(first);

  const { data, error } = await supabase
    .from("budgets")
    .select("id,category_id,amount,period_start,period_end,alert_threshold")
    .lte("period_start", to)
    .gte("period_end", from)
    .order("category_id", { nullsFirst: true });
  dbError(error);
  const budgets = (data ?? []) as Budget[];
  const minStart = budgets.reduce((m, b) => (b.period_start < m ? b.period_start : m), from);
  const maxEnd = budgets.reduce((m, b) => (b.period_end > m ? b.period_end : m), to);
  const [categories, rows] = await Promise.all([getCategories(supabase), getTxRows(supabase, minStart, maxEnd)]);
  return json({ month, from, to, items: budgetStatuses(budgets, rows, categories) });
});

export const POST = withUser(async ({ req, supabase, user }) => {
  const parsed = budgetInput.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const input = parsed.data;
  if (input.category_id) {
    const { data: cat } = await supabase.from("categories").select("type").eq("id", input.category_id).maybeSingle();
    if (!cat) throw new ApiError(400, "ไม่พบหมวดหมู่");
    if (cat.type !== "expense") throw new ApiError(400, "ตั้งงบได้เฉพาะหมวดรายจ่าย");
  }
  const { data, error } = await supabase
    .from("budgets")
    .insert({ ...input, category_id: input.category_id ?? null, user_id: user.id })
    .select()
    .single();
  if (error?.code === "23505") throw new ApiError(409, "มีงบของหมวดนี้ในช่วงเวลานี้แล้ว แก้ไขงบเดิมแทนได้");
  dbError(error);
  return json({ item: data }, 201);
});
