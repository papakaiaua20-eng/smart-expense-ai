import { emptyForm, type FieldFlags, type FormValues } from "@/components/app/transaction-form";
import type { ParsedSlip } from "@/lib/slip/parser";

export type ScanResp = {
  receipt_id: string;
  status: "success" | "needs_review" | "failed" | "not_configured";
  message: string | null;
  provider?: string;
  raw_text?: string;
  parsed: ParsedSlip | null;
  category?: { categoryId: string | null; confidence: number; reason: string } | null;
  counterparty?: string | null;
  duplicate: { level: string; reason: string | null; matches: { id: string; amount: string | number; transaction_date: string; merchant_name: string | null }[] } | null;
};

export type ProfileResp = {
  profile: { account_names: string[]; ocr_consent_at: string | null };
  ocr: { id: string; label: string; external: boolean } | null;
};

export type Stage = "pick" | "preview" | "scanning" | "review" | "saved";

export const STEPS = ["ตรวจสอบไฟล์", "อ่านข้อความ (OCR)", "แยกข้อมูลธุรกรรม", "ตรวจรายการซ้ำ", "เสนอหมวดหมู่"];

export function toForm(r: ScanResp): { values: FormValues; flags: FieldFlags } {
  const p = r.parsed;
  const v = emptyForm("expense");
  if (!p) return { values: { ...v, type: "" }, flags: {} };
  const kindPm = p.kind.value === "transfer" ? "โอนผ่านธนาคาร" : "";
  return {
    values: {
      ...v,
      type: p.suggestedType.value ?? "",
      amount: p.amount.value !== null ? p.amount.value.toFixed(2) : "",
      transaction_date: p.date.value ?? "",
      transaction_time: p.time.value ?? "",
      category_id: r.category?.categoryId ?? "",
      merchant_name: r.counterparty ?? "",
      payment_method: kindPm,
      bank: p.bank.value ?? "",
      reference_number: p.reference.value ?? "",
    },
    flags: {
      type: p.suggestedType.status,
      amount: p.amount.status,
      transaction_date: p.date.status,
      transaction_time: p.time.status,
      bank: p.bank.status,
      reference_number: p.reference.status,
      merchant_name: r.counterparty ? (p.suggestedType.value === "income" ? p.senderName.status : p.receiverName.status) : "missing",
    },
  };
}

