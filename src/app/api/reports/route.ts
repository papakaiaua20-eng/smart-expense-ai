import { ApiError, json, withUser } from "@/lib/api";
import { isValidISODate, previousRange, type Granularity } from "@/lib/dates";
import { getCategories, getTxRows } from "@/lib/server/data";
import { compareCategories, summarize } from "@/lib/summary";

export const dynamic = "force-dynamic";
const GRAN: Granularity[] = ["day", "week", "month", "year"];

// GET /api/reports?from&to&granularity=day|week|month|year
export const GET = withUser(async ({ req, supabase }) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const g = (sp.get("granularity") ?? "month") as Granularity;
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) throw new ApiError(400, "ช่วงวันที่ไม่ถูกต้อง");
  if (!GRAN.includes(g)) throw new ApiError(400, "รูปแบบสรุปไม่ถูกต้อง");
  if (Date.parse(to) - Date.parse(from) > 10 * 366 * 86400000) throw new ApiError(400, "ช่วงวันที่ยาวเกิน 10 ปี");

  const prev = previousRange(from, to);
  const [categories, rows] = await Promise.all([getCategories(supabase), getTxRows(supabase, prev.from, to)]);
  const current = summarize(rows, categories, from, to, g);
  const previous = summarize(rows, categories, prev.from, prev.to, g);
  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 1000) / 10 : null);

  return json({
    current,
    previous: { from: prev.from, to: prev.to, income: previous.income, expense: previous.expense, net: previous.net, count: previous.count },
    change: {
      income: pct(current.income, previous.income),
      expense: pct(current.expense, previous.expense),
    },
    categories: compareCategories(current.expenseByCategory, previous.expenseByCategory),
  });
});
