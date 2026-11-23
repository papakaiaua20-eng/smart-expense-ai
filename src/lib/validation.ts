import { z } from "zod";
import { isValidISODate } from "./dates";

const isoDate = z.string().refine(isValidISODate, "วันที่ไม่ถูกต้อง");
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `ยาวเกิน ${max} ตัวอักษร`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

export const amountSchema = z.coerce
  .number({ message: "กรุณากรอกจำนวนเงิน" })
  .refine((v) => Number.isFinite(v) && v > 0, "จำนวนเงินต้องมากกว่า 0")
  .refine((v) => v < 1e12, "จำนวนเงินมากเกินไป")
  .transform((v) => Math.round(v * 100) / 100);

export const transactionInput = z
  .object({
    type: z.enum(["income", "expense", "transfer"], { message: "กรุณาเลือกประเภท" }),
    amount: amountSchema,
    transaction_date: isoDate,
    transaction_time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "เวลาไม่ถูกต้อง")
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    category_id: z.string().uuid().nullable().optional().or(z.literal("").transform(() => null)),
    merchant_name: optText(120),
    payment_method: optText(40),
    bank: optText(60),
    sender_name: optText(120),
    receiver_name: optText(120),
    reference_number: z
      .string()
      .trim()
      .max(64)
      .regex(/^[A-Za-z0-9-]*$/, "เลขอ้างอิงมีได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ -")
      .transform((v) => (v === "" ? null : v))
      .nullable()
      .optional(),
    note: optText(500),
    receipt_id: z.string().uuid().nullable().optional(),
    source: z.enum(["manual", "ocr"]).default("manual"),
    confirm_duplicate: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type !== "transfer" && !v.category_id) {
      ctx.addIssue({ code: "custom", path: ["category_id"], message: "กรุณาเลือกหมวดหมู่" });
    }
  });

export type TransactionInput = z.infer<typeof transactionInput>;

export const transactionPatch = z
  .object({
    type: z.enum(["income", "expense", "transfer"]),
    amount: amountSchema,
    transaction_date: isoDate,
    transaction_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).nullable().or(z.literal("").transform(() => null)),
    category_id: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
    merchant_name: optText(120),
    payment_method: optText(40),
    bank: optText(60),
    reference_number: z.string().trim().max(64).regex(/^[A-Za-z0-9-]*$/).transform((v) => (v === "" ? null : v)).nullable(),
    note: optText(500),
  })
  .partial();

export const transactionQuery = z.object({
  from: isoDate.optional(),
  to: isoDate.optional(),
  type: z.enum(["income", "expense", "transfer"]).optional(),
  category_id: z.string().uuid().optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["date_desc", "date_asc", "amount_desc", "amount_asc"]).default("date_desc"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(20),
});

export const budgetInput = z.object({
  category_id: z.string().uuid().nullable().optional(),
  amount: amountSchema,
  period_start: isoDate,
  period_end: isoDate,
  alert_threshold: z.coerce.number().min(1).max(100).default(80),
}).refine((v) => v.period_end >= v.period_start, { path: ["period_end"], message: "วันสิ้นสุดต้องไม่ก่อนวันเริ่ม" });

export const budgetPatch = z.object({
  amount: amountSchema.optional(),
  alert_threshold: z.coerce.number().min(1).max(100).optional(),
});

export const categoryInput = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อหมวดหมู่").max(60),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).default("#64748B"),
  icon: z.string().max(40).default("circle"),
});

export const profilePatch = z.object({
  display_name: optText(80),
  account_names: z.array(z.string().trim().min(2).max(120)).max(10).optional(),
  keep_receipt_images: z.boolean().optional(),
  ocr_consent: z.boolean().optional(),
  budget_alert_enabled: z.boolean().optional(),
});

export function zodMessage(err: z.ZodError): string {
  const first = err.issues[0];
  return first?.message ?? "ข้อมูลไม่ถูกต้อง";
}
