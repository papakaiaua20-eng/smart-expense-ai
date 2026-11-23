import { ApiError, dbError, json, withUser } from "@/lib/api";
import { autoGranularity, endOfMonth, resolveRange, startOfMonth, todayISO, type RangePreset } from "@/lib/dates";
import { getCategories, getTxRows } from "@/lib/server/data";
import { budgetStatuses, summarize } from "@/lib/summary";
import type { Budget } from "@/lib/types";

export const dynamic = "force-dynamic";
const PRESETS: RangePreset[] = ["today", "7d", "this_month", "last_month", "this_year", "custom"];

// GET /api/dashboard/summary?range=this_month | custom&from=YYYY-MM-DD&to=YYYY-MM-DD
export const GET = withUser(async ({ req, supabase, user }) => {
  const sp = new URL(req.url).searchParams;
  const preset = (sp.get("range") ?? "this_month") as RangePreset;
  if (!PRESETS.includes(preset)) throw new ApiError(400, "ช่วงเวลาไม่ถูกต้อง");
  const { from, to } = resolveRange(preset, { from: sp.get("from"), to: sp.get("to") });

  const today = todayISO();
  const mStart = startOfMonth(today);
  const mEnd = endOfMonth(today);

  const [categories, rows, budgetsRes, recentRes, notif] = await Promise.all([
    getCategories(supabase),
    getTxRows(supabase, from < mStart ? from : mStart, to > mEnd ? to : mEnd),
    supabase
      .from("budgets")
      .select("id,category_id,amount,period_start,period_end,alert_threshold")
      .lte("period_start", today)
      .gte("period_end", today),
    supabase
      .from("transactions")
      .select("id,type,amount,merchant_name,transaction_date,transaction_time,source,category:categories(id,name,color,icon,type)")
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("notification_settings").select("budget_alert_enabled").eq("user_id", user.id).maybeSingle(),
  ]);
  dbError(budgetsRes.error);
  dbError(recentRes.error);

  const summary = summarize(rows, categories, from, to, autoGranularity(from, to));
  const budgets = budgetStatuses((budgetsRes.data ?? []) as Budget[], rows, categories);
  const alertsEnabled = notif.data?.budget_alert_enabled ?? true;

  return json({
    preset,
    ...summary,
    budgets,
    budgetAlerts: alertsEnabled ? budgets.filter((b) => b.level !== "ok") : [],
    recent: recentRes.data ?? [],
  });
});
