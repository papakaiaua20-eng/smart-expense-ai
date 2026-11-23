// Pure aggregation helpers. Amounts are summed in satang (integers) to avoid float drift.
import { bucketKey, bucketKeys, bucketLabel, type Granularity } from "./dates";
import type { Budget, TxType } from "./types";

export type TxRow = {
  type: TxType;
  amount: string | number;
  transaction_date: string;
  category_id: string | null;
};

export type CategoryRef = { id: string; name: string; color: string; type: "income" | "expense" };

const sat = (v: string | number) => Math.round(Number(v) * 100);
const baht = (s: number) => s / 100;

export type Summary = {
  from: string;
  to: string;
  income: number;
  expense: number;
  net: number;
  transferTotal: number;
  count: number;
  topExpenseCategory: { id: string | null; name: string; amount: number; color: string } | null;
  expenseByCategory: { id: string | null; name: string; color: string; amount: number; percent: number }[];
  incomeByCategory: { id: string | null; name: string; color: string; amount: number; percent: number }[];
  granularity: Granularity;
  series: { key: string; label: string; income: number; expense: number; net: number }[];
};

function byCategory(rows: TxRow[], type: "income" | "expense", cats: Map<string, CategoryRef>) {
  const m = new Map<string | null, number>();
  for (const r of rows) if (r.type === type) m.set(r.category_id, (m.get(r.category_id) ?? 0) + sat(r.amount));
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()]
    .map(([id, s]) => {
      const c = id ? cats.get(id) : undefined;
      return {
        id,
        name: c?.name ?? "ไม่ระบุหมวดหมู่",
        color: c?.color ?? "#94A3B8",
        amount: baht(s),
        percent: total ? Math.round((s / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function summarize(
  rows: TxRow[],
  categories: CategoryRef[],
  from: string,
  to: string,
  granularity: Granularity,
): Summary {
  const cats = new Map(categories.map((c) => [c.id, c]));
  const inRange = rows.filter((r) => r.transaction_date >= from && r.transaction_date <= to);
  let inc = 0;
  let exp = 0;
  let trf = 0;
  for (const r of inRange) {
    if (r.type === "income") inc += sat(r.amount);
    else if (r.type === "expense") exp += sat(r.amount);
    else trf += sat(r.amount); // transfers between own accounts are excluded from income/expense
  }

  const buckets = new Map(bucketKeys(from, to, granularity).map((k) => [k, { inc: 0, exp: 0 }]));
  for (const r of inRange) {
    const b = buckets.get(bucketKey(r.transaction_date, granularity));
    if (!b) continue;
    if (r.type === "income") b.inc += sat(r.amount);
    else if (r.type === "expense") b.exp += sat(r.amount);
  }

  const expenseByCategory = byCategory(inRange, "expense", cats);
  const top = expenseByCategory[0];
  return {
    from,
    to,
    income: baht(inc),
    expense: baht(exp),
    net: baht(inc - exp),
    transferTotal: baht(trf),
    count: inRange.length,
    topExpenseCategory: top ? { id: top.id, name: top.name, amount: top.amount, color: top.color } : null,
    expenseByCategory,
    incomeByCategory: byCategory(inRange, "income", cats),
    granularity,
    series: [...buckets.entries()].map(([key, b]) => ({
      key,
      label: bucketLabel(key, granularity),
      income: baht(b.inc),
      expense: baht(b.exp),
      net: baht(b.inc - b.exp),
    })),
  };
}

export type BudgetStatusLevel = "ok" | "warning" | "reached" | "exceeded";

export type BudgetStatus = {
  id: string;
  category_id: string | null;
  categoryName: string;
  color: string;
  amount: number;
  spent: number;
  remaining: number;
  percent: number;
  alertThreshold: number;
  level: BudgetStatusLevel;
  period_start: string;
  period_end: string;
};

export function budgetLevel(percent: number, threshold: number): BudgetStatusLevel {
  if (percent > 100) return "exceeded";
  if (percent >= 100) return "reached";
  if (percent >= threshold) return "warning";
  return "ok";
}

export function budgetStatuses(budgets: Budget[], rows: TxRow[], categories: CategoryRef[]): BudgetStatus[] {
  const cats = new Map(categories.map((c) => [c.id, c]));
  return budgets.map((b) => {
    let spentS = 0;
    for (const r of rows) {
      if (r.type !== "expense") continue;
      if (r.transaction_date < b.period_start || r.transaction_date > b.period_end) continue;
      if (b.category_id && r.category_id !== b.category_id) continue;
      spentS += sat(r.amount);
    }
    const amountS = sat(b.amount);
    const percent = amountS ? Math.round((spentS / amountS) * 1000) / 10 : 0;
    const threshold = Number(b.alert_threshold);
    const c = b.category_id ? cats.get(b.category_id) : undefined;
    return {
      id: b.id,
      category_id: b.category_id,
      categoryName: b.category_id ? (c?.name ?? "หมวดที่ถูกลบ") : "งบรวมทุกหมวด",
      color: c?.color ?? "#2563EB",
      amount: baht(amountS),
      spent: baht(spentS),
      remaining: baht(amountS - spentS),
      percent,
      alertThreshold: threshold,
      level: budgetLevel(percent, threshold),
      period_start: b.period_start,
      period_end: b.period_end,
    };
  });
}

export type CategoryComparison = {
  id: string | null;
  name: string;
  color: string;
  current: number;
  previous: number;
  change: number;
  changePercent: number | null; // null when previous is 0
};

export function compareCategories(
  current: Summary["expenseByCategory"],
  previous: Summary["expenseByCategory"],
): CategoryComparison[] {
  const ids = new Set([...current.map((c) => c.id), ...previous.map((c) => c.id)]);
  return [...ids]
    .map((id) => {
      const c = current.find((x) => x.id === id);
      const p = previous.find((x) => x.id === id);
      const cur = c?.amount ?? 0;
      const prev = p?.amount ?? 0;
      return {
        id,
        name: c?.name ?? p?.name ?? "ไม่ระบุหมวดหมู่",
        color: c?.color ?? p?.color ?? "#94A3B8",
        current: cur,
        previous: prev,
        change: Math.round((cur - prev) * 100) / 100,
        changePercent: prev ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => b.current - a.current);
}
