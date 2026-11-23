import { describe, expect, it } from "vitest";
import { summarize, budgetStatuses } from "@/lib/summary";
import { resolveRange, previousRange, bucketKeys } from "@/lib/dates";
import { classifyDuplicates } from "@/lib/dedupe";
import { suggestCategory } from "@/lib/categorize";
import { toCsv } from "@/lib/csv";
import { maskAccount } from "@/lib/utils";

const cats = [
  { id: "food", name: "อาหารและเครื่องดื่ม", color: "#F97316", type: "expense" as const },
  { id: "travel", name: "เดินทาง", color: "#0EA5E9", type: "expense" as const },
  { id: "other", name: "อื่น ๆ", color: "#64748B", type: "expense" as const },
  { id: "salary", name: "เงินเดือน", color: "#16A34A", type: "income" as const },
];

describe("summarize", () => {
  const rows = [
    { type: "income" as const, amount: "30000.00", transaction_date: "2026-11-01", category_id: "salary" },
    { type: "expense" as const, amount: "0.10", transaction_date: "2026-11-02", category_id: "food" },
    { type: "expense" as const, amount: "0.20", transaction_date: "2026-11-02", category_id: "food" },
    { type: "expense" as const, amount: 500, transaction_date: "2026-11-05", category_id: "travel" },
    { type: "transfer" as const, amount: 10000, transaction_date: "2026-11-06", category_id: null },
    { type: "expense" as const, amount: 99, transaction_date: "2026-12-01", category_id: "food" },
  ];
  const s = summarize(rows, cats, "2026-11-01", "2026-11-30", "day");
  it("totals without float drift and excludes transfers", () => {
    expect(s.income).toBe(30000);
    expect(s.expense).toBe(500.3);
    expect(s.net).toBe(29499.7);
    expect(s.transferTotal).toBe(10000);
    expect(s.count).toBe(5);
  });
  it("finds the top category and percentages", () => {
    expect(s.topExpenseCategory?.name).toBe("เดินทาง");
    expect(s.expenseByCategory.map((c) => c.percent).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 0);
  });
  it("creates one bucket per day of the range", () => {
    expect(s.series).toHaveLength(30);
    expect(s.series[1].expense).toBe(0.3);
  });
});

describe("budgets", () => {
  const rows = [
    { type: "expense" as const, amount: 3500, transaction_date: "2026-11-10", category_id: "food" },
    { type: "expense" as const, amount: 2000, transaction_date: "2026-11-11", category_id: "travel" },
  ];
  const b = (id: string, category_id: string | null, amount: number) => ({
    id, category_id, amount, period_start: "2026-11-01", period_end: "2026-11-30", alert_threshold: 80,
  });
  it("computes the brief's example (5,000 / 3,500 = 70%)", () => {
    const [food] = budgetStatuses([b("1", "food", 5000)], rows, cats);
    expect(food.spent).toBe(3500);
    expect(food.remaining).toBe(1500);
    expect(food.percent).toBe(70);
    expect(food.level).toBe("ok");
  });
  it("levels: warning at 80%, reached at 100%, exceeded above", () => {
    expect(budgetStatuses([b("1", "food", 4375)], rows, cats)[0].level).toBe("warning");
    expect(budgetStatuses([b("1", "food", 3500)], rows, cats)[0].level).toBe("reached");
    expect(budgetStatuses([b("1", null, 5000)], rows, cats)[0].level).toBe("exceeded");
  });
});

describe("dates", () => {
  const now = new Date("2026-11-20T20:00:00Z"); // 03:00 on the 21st in Bangkok
  it("uses Bangkok time", () => {
    expect(resolveRange("today", undefined, now)).toEqual({ from: "2026-11-21", to: "2026-11-21" });
  });
  it("resolves presets", () => {
    expect(resolveRange("last_month", undefined, now)).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(resolveRange("7d", undefined, now)).toEqual({ from: "2026-11-15", to: "2026-11-21" });
    expect(resolveRange("custom", { from: "2026-02-10", to: "2026-01-01" }, now)).toEqual({ from: "2026-01-01", to: "2026-02-10" });
  });
  it("previous range", () => {
    expect(previousRange("2026-11-01", "2026-11-30")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(previousRange("2026-11-15", "2026-11-21")).toEqual({ from: "2026-11-08", to: "2026-11-14" });
  });
  it("buckets", () => {
    expect(bucketKeys("2026-01-15", "2026-03-02", "month")).toEqual(["2026-01", "2026-02", "2026-03"]);
  });
});

describe("dedupe", () => {
  const existing = [
    { id: "a", amount: "120.50", transaction_date: "2026-11-20", transaction_time: "14:32:00", reference_number: "REF1", merchant_name: "ร้าน A", type: "expense" },
  ];
  it("exact by reference + amount", () => {
    expect(classifyDuplicates({ amount: 120.5, transaction_date: "2026-11-21", reference_number: "REF1" }, existing).level).toBe("exact");
  });
  it("possible by amount + date + time", () => {
    expect(classifyDuplicates({ amount: 120.5, transaction_date: "2026-11-20", transaction_time: "14:32" }, existing).level).toBe("possible");
  });
  it("different references are not duplicates", () => {
    expect(classifyDuplicates({ amount: 120.5, transaction_date: "2026-11-20", transaction_time: "14:32", reference_number: "REF2" }, existing).level).toBe("none");
  });
  it("ignores itself when editing", () => {
    expect(classifyDuplicates({ amount: 120.5, transaction_date: "2026-11-20", reference_number: "REF1" }, existing, "a").level).toBe("none");
  });
});

describe("categorize", () => {
  const c = cats.map(({ id, name, type }) => ({ id, name, type }));
  it("uses learned rules first", () => {
    const s = suggestCategory({ merchant: "ร้านป้าแดง", type: "expense", categories: c, rules: [{ merchant_pattern: "ป้าแดง", category_id: "travel", hit_count: 3 }] });
    expect(s.categoryId).toBe("travel");
    expect(s.confidence).toBeGreaterThan(0.9);
  });
  it("falls back to keywords then อื่น ๆ", () => {
    expect(suggestCategory({ merchant: "7-ELEVEN สาขา 1234", type: "expense", categories: c }).categoryId).toBe("food");
    expect(suggestCategory({ merchant: "BTS Skytrain", type: "expense", categories: c }).categoryId).toBe("travel");
    expect(suggestCategory({ merchant: "xyz", type: "expense", categories: c }).categoryId).toBe("other");
  });
});

describe("misc", () => {
  it("csv escapes and blocks formulas", () => {
    const csv = toCsv(["a", "b"], [["=1+1", 'say "hi", ok'], [-5, null]]);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain('"say ""hi"", ok"');
    expect(csv).toContain("-5,");
    expect(csv.startsWith("﻿")).toBe(true);
  });
  it("masks account numbers", () => {
    expect(maskAccount("บัญชี 123-4-56789-0")).toBe("บัญชี xxxxxx7890");
  });
});
