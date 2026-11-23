// Converts a backup file from the "บัญชีออฟฟิศ" app ({app:"office-ledger", entries, budgets}) into
// Smart Expense AI rows. Pure functions so they can be unit tested.
import { z } from "zod";
import { isValidISODate } from "../dates";

export const officeEntry = z
  .object({
    id: z.string().max(100).optional(),
    date: z.string(),
    type: z.enum(["income", "expense"]).catch("expense"),
    amount: z.coerce.number(),
    category: z.string().max(100).optional().default(""),
    description: z.string().max(500).optional().default(""),
    vendor: z.string().max(200).optional().default(""),
    note: z.string().max(1000).optional().default(""),
    method: z.string().max(100).optional().default(""),
    bank: z.string().max(100).optional().default(""),
    tags: z.array(z.string().max(60)).max(30).optional().default([]),
    qty: z.coerce.number().optional().nullable(),
    unitPrice: z.coerce.number().optional().nullable(),
    example: z.boolean().optional(),
    createdAt: z.number().optional(),
  })
  .passthrough();

export const officeBackup = z.object({
  app: z.literal("office-ledger", { message: "ไฟล์นี้ไม่ใช่ไฟล์สำรองจากบัญชีออฟฟิศ" }),
  version: z.number().optional(),
  entries: z.array(z.unknown()).max(20000, "รายการเยอะเกิน 20,000 รายการ"),
  budgets: z.object({ monthly: z.record(z.string(), z.coerce.number()).optional() }).partial().optional(),
});

export type OfficeEntry = z.infer<typeof officeEntry>;

// office category -> Smart Expense default category (same meaning). Others are kept by name as custom categories.
export const CATEGORY_MAP: Record<string, string> = {
  "อาหาร / เครื่องดื่ม": "อาหาร/รับรองลูกค้า",
  "ค่าเดินทาง / ขนส่ง": "ค่าเดินทาง/น้ำมัน",
  "ค่าน้ำ ค่าไฟ": "ค่าน้ำ ค่าไฟ",
  "ค่าอินเทอร์เน็ต / โทรศัพท์": "ค่าอินเทอร์เน็ต/โทรศัพท์",
  "สั่งของ / วัสดุสำนักงาน": "อุปกรณ์สำนักงาน/เครื่องเขียน",
  "ซ่อมบำรุง / ทำความสะอาด": "ซ่อมบำรุง",
  "ค่าใช้จ่ายอื่นๆ": "อื่น ๆ",
  "รายรับอื่นๆ": "อื่น ๆ",
};

export function targetCategory(e: Pick<OfficeEntry, "category" | "type">): string {
  const name = (e.category ?? "").trim();
  if (!name) return "อื่น ๆ";
  return CATEGORY_MAP[name] ?? name.slice(0, 60);
}

const clean = (s: string | null | undefined) => (s ?? "").replace(/[​-‍﻿]/g, "").trim();

/** Stable id for dedup: the entry id, or a fingerprint when the file has none. */
export function importKey(e: OfficeEntry): string {
  if (e.id) return `office-ledger:${e.id}`.slice(0, 120);
  const fp = [e.date, e.type, e.amount, clean(e.description), clean(e.vendor), e.createdAt ?? ""].join("|");
  let h = 2166136261;
  for (let i = 0; i < fp.length; i++) h = Math.imul(h ^ fp.charCodeAt(i), 16777619);
  return `office-ledger:fp-${(h >>> 0).toString(36)}`;
}

export type ImportRow = {
  import_key: string;
  type: "income" | "expense";
  amount: number;
  transaction_date: string;
  categoryName: string;
  merchant_name: string | null;
  payment_method: string | null;
  bank: string | null;
  note: string | null;
};

export type Prepared = { rows: ImportRow[]; skipped: { reason: string; count: number }[]; categoryNames: { name: string; type: "income" | "expense" }[] };

export function prepareImport(rawEntries: unknown[]): Prepared {
  const rows: ImportRow[] = [];
  const skip = new Map<string, number>();
  const bump = (r: string) => skip.set(r, (skip.get(r) ?? 0) + 1);
  const seen = new Set<string>();

  for (const raw of rawEntries) {
    const p = officeEntry.safeParse(raw);
    if (!p.success) { bump("ข้อมูลไม่ครบ"); continue; }
    const e = p.data;
    if (e.example) { bump("รายการตัวอย่าง"); continue; }
    if (!isValidISODate(e.date)) { bump("วันที่ไม่ถูกต้อง"); continue; }
    const amount = Math.round(e.amount * 100) / 100;
    if (!(amount > 0) || amount >= 1e12) { bump("จำนวนเงินไม่ถูกต้อง"); continue; }
    const key = importKey(e);
    if (seen.has(key)) { bump("ซ้ำในไฟล์"); continue; }
    seen.add(key);

    const desc = clean(e.description);
    const vendor = clean(e.vendor);
    const noteParts = [
      desc && desc !== vendor ? desc : "",
      e.qty ? `${e.qty} × ${e.unitPrice ?? 0} บาท` : "",
      clean(e.note),
      (e.tags ?? []).filter(Boolean).map((t) => `#${clean(t)}`).join(" "),
    ].filter(Boolean);

    rows.push({
      import_key: key,
      type: e.type,
      amount,
      transaction_date: e.date,
      categoryName: targetCategory(e),
      merchant_name: (vendor || desc).slice(0, 120) || null,
      payment_method: clean(e.method).slice(0, 40) || null,
      bank: clean(e.bank).slice(0, 60) || null,
      note: noteParts.join(" · ").slice(0, 500) || null,
    });
  }

  const cats = new Map<string, { name: string; type: "income" | "expense" }>();
  for (const r of rows) cats.set(`${r.type}:${r.categoryName}`, { name: r.categoryName, type: r.type });
  return {
    rows,
    skipped: [...skip.entries()].map(([reason, count]) => ({ reason, count })),
    categoryNames: [...cats.values()],
  };
}

export function budgetCategoryName(officeName: string): string | null {
  if (officeName === "__total") return null;
  return targetCategory({ category: officeName, type: "expense" });
}
