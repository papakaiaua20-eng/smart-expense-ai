"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/fetcher";
import { todayISO } from "@/lib/dates";
import { cn, formatTHB, formatThaiDate } from "@/lib/utils";
import { PAYMENT_METHODS, type Category, type Transaction, type TxType } from "@/lib/types";

export type FormValues = {
  type: TxType | "";
  amount: string;
  transaction_date: string;
  transaction_time: string;
  category_id: string;
  merchant_name: string;
  payment_method: string;
  bank: string;
  reference_number: string;
  note: string;
};

export type FieldFlags = Partial<Record<keyof FormValues, "ok" | "review" | "missing">>;

type DupMatch = { id: string; amount: string | number; transaction_date: string; merchant_name: string | null; reference_number: string | null };

export function emptyForm(type: TxType = "expense"): FormValues {
  return {
    type,
    amount: "",
    transaction_date: todayISO(),
    transaction_time: "",
    category_id: "",
    merchant_name: "",
    payment_method: "",
    bank: "",
    reference_number: "",
    note: "",
  };
}

export function formFromTx(t: Transaction): FormValues {
  return {
    type: t.type,
    amount: String(Number(t.amount)),
    transaction_date: t.transaction_date,
    transaction_time: t.transaction_time?.slice(0, 5) ?? "",
    category_id: t.category_id ?? "",
    merchant_name: t.merchant_name ?? "",
    payment_method: t.payment_method ?? "",
    bank: t.bank ?? "",
    reference_number: t.reference_number ?? "",
    note: t.note ?? "",
  };
}

const TYPE_OPTIONS: { value: TxType; label: string; cls: string }[] = [
  { value: "expense", label: "รายจ่าย", cls: "data-[on=true]:bg-expense data-[on=true]:text-white" },
  { value: "income", label: "รายรับ", cls: "data-[on=true]:bg-income data-[on=true]:text-white" },
  { value: "transfer", label: "โอนระหว่างบัญชี", cls: "data-[on=true]:bg-slate-700 data-[on=true]:text-white" },
];

function ReviewHint({ flag }: { flag?: "ok" | "review" | "missing" }) {
  if (flag === "review") return <Badge variant="warning">ต้องตรวจสอบ</Badge>;
  if (flag === "missing") return <Badge variant="outline">อ่านไม่พบ</Badge>;
  return null;
}

export function TransactionForm({
  categories,
  initial,
  editId,
  receiptId,
  source = "manual",
  flags,
  categoryHint,
  extra,
  submitLabel = "บันทึกรายการ",
  onSaved,
  onCancel,
}: {
  categories: Category[];
  initial: FormValues;
  editId?: string;
  receiptId?: string | null;
  source?: "manual" | "ocr";
  flags?: FieldFlags;
  categoryHint?: { confidence: number; reason: string } | null;
  extra?: { sender_name?: string | null; receiver_name?: string | null };
  submitLabel?: string;
  onSaved: (t: Transaction) => void;
  onCancel?: () => void;
}) {
  const [v, setV] = useState<FormValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [saving, setSaving] = useState(false);
  const [dup, setDup] = useState<{ level: "possible" | "exact"; message: string; matches: DupMatch[] } | null>(null);
  const [hint, setHint] = useState(categoryHint ?? null);
  const [catTouched, setCatTouched] = useState(!!editId);


  const cats = useMemo(
    () => categories.filter((c) => (v.type === "income" ? c.type === "income" : c.type === "expense")),
    [categories, v.type],
  );

  const set = <K extends keyof FormValues>(k: K, val: FormValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: undefined }));
    setDup(null);
  };

  const changeType = (t: TxType) => {
    setV((p) => ({ ...p, type: t, category_id: "" }));
    setHint(null);
    setCatTouched(false);
    setDup(null);
    setErrors((e) => ({ ...e, type: undefined }));
    void suggest(t, true);
  };

  async function suggest(typeOverride?: TxType, force = false) {
    const type = typeOverride ?? v.type;
    if ((catTouched && !force) || !v.merchant_name.trim() || type === "transfer" || !type) return;
    try {
      const s = await api<{ categoryId: string | null; confidence: number; reason: string }>("/api/categories/suggest", {
        method: "POST",
        json: { merchant: v.merchant_name, type },
      });
      if (s.categoryId) {
        setV((p) => ({ ...p, category_id: s.categoryId! }));
        setHint({ confidence: s.confidence, reason: s.reason });
      }
    } catch {
      /* suggestion is optional */
    }
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!v.type) e.type = "กรุณาเลือกประเภท";
    const amt = Number(v.amount);
    if (!v.amount || !Number.isFinite(amt) || amt <= 0) e.amount = "กรุณากรอกจำนวนเงินมากกว่า 0";
    if (!v.transaction_date) e.transaction_date = "กรุณาเลือกวันที่";
    if (v.type !== "transfer" && !v.category_id) e.category_id = "กรุณาเลือกหมวดหมู่";
    if (v.reference_number && !/^[A-Za-z0-9-]+$/.test(v.reference_number))
      e.reference_number = "ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ -";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(confirmDuplicate = false) {
    if (!validate()) return;
    setSaving(true);
    try {
      const body = {
        type: v.type,
        amount: Number(v.amount),
        transaction_date: v.transaction_date,
        transaction_time: v.transaction_time || null,
        category_id: v.type === "transfer" ? null : v.category_id || null,
        merchant_name: v.merchant_name,
        payment_method: v.payment_method,
        bank: v.bank,
        reference_number: v.reference_number,
        note: v.note,
        ...(editId
          ? {}
          : {
              source,
              receipt_id: receiptId ?? null,
              sender_name: extra?.sender_name ?? null,
              receiver_name: extra?.receiver_name ?? null,
              confirm_duplicate: confirmDuplicate,
            }),
      };
      const res = editId
        ? await api<{ item: Transaction }>(`/api/transactions/${editId}`, { method: "PATCH", json: body })
        : await api<{ item: Transaction }>("/api/transactions", { method: "POST", json: body });
      toast.success(editId ? "แก้ไขรายการแล้ว" : "บันทึกรายการแล้ว");
      onSaved(res.item);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 409 && e.body.code === "duplicate") {
        setDup({
          level: (e.body.level as "possible" | "exact") ?? "exact",
          message: e.message,
          matches: (e.body.matches as DupMatch[]) ?? [],
        });
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setSaving(false);
    }
  }

  const fieldCls = (k: keyof FormValues) =>
    cn(flags?.[k] === "review" && "border-amber-400 bg-amber-50/50", flags?.[k] === "missing" && "border-dashed");

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className="flex flex-col gap-4"
    >
      <fieldset>
        <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium">
          ประเภท <ReviewHint flag={flags?.type} />
        </legend>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
          {TYPE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              data-on={v.type === o.value}
              aria-pressed={v.type === o.value}
              onClick={() => changeType(o.value)}
              className={cn("min-h-10 rounded-lg px-1 text-xs font-medium text-muted sm:text-sm", o.cls)}
            >
              {o.label}
            </button>
          ))}
        </div>
        {errors.type && <p className="mt-1 text-xs text-expense">{errors.type}</p>}
        {v.type === "transfer" && (
          <p className="mt-1.5 text-xs text-muted">รายการโอนระหว่างบัญชีของตัวเองจะไม่ถูกนับเป็นรายรับหรือรายจ่าย</p>
        )}
      </fieldset>

      <div>
        <Label htmlFor="amount" className="mb-1.5 flex items-center gap-2">
          จำนวนเงิน (บาท) <ReviewHint flag={flags?.amount} />
        </Label>
        <Input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.00"
          value={v.amount}
          onChange={(e) => set("amount", e.target.value.replace(/[^\d.]/g, ""))}
          aria-invalid={!!errors.amount}
          className={cn("text-lg font-semibold tabular", fieldCls("amount"))}
        />
        {errors.amount && <p className="mt-1 text-xs text-expense">{errors.amount}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Label htmlFor="date" className="mb-1.5 flex items-center gap-2">
            วันที่ <ReviewHint flag={flags?.transaction_date} />
          </Label>
          <Input
            id="date"
            type="date"
            value={v.transaction_date}
            onChange={(e) => set("transaction_date", e.target.value)}
            aria-invalid={!!errors.transaction_date}
            className={fieldCls("transaction_date")}
          />
          {errors.transaction_date && <p className="mt-1 text-xs text-expense">{errors.transaction_date}</p>}
        </div>
        <div className="min-w-0">
          <Label htmlFor="time" className="mb-1.5 flex items-center gap-2">
            เวลา <ReviewHint flag={flags?.transaction_time} />
          </Label>
          <Input
            id="time"
            type="time"
            value={v.transaction_time}
            onChange={(e) => set("transaction_time", e.target.value)}
            className={fieldCls("transaction_time")}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="merchant" className="mb-1.5 flex items-center gap-2">
          {v.type === "income" ? "ผู้จ่าย / แหล่งรายได้" : "ร้านค้า / ผู้เกี่ยวข้อง"} <ReviewHint flag={flags?.merchant_name} />
        </Label>
        <Input
          id="merchant"
          value={v.merchant_name}
          maxLength={120}
          placeholder={v.type === "income" ? "เช่น บริษัท ABC" : "เช่น 7-Eleven, ร้านกาแฟ"}
          onChange={(e) => set("merchant_name", e.target.value)}
          onBlur={() => void suggest()}
          className={fieldCls("merchant_name")}
        />
      </div>

      {v.type !== "transfer" && (
        <div>
          <Label htmlFor="category" className="mb-1.5 flex flex-wrap items-center gap-2">
            หมวดหมู่
            {hint && v.category_id && (
              <Badge variant={hint.confidence >= 0.7 ? "default" : "warning"}>
                <Sparkles className="size-3" /> ระบบแนะนำ · มั่นใจ {Math.round(hint.confidence * 100)}%
              </Badge>
            )}
          </Label>
          <NativeSelect
            id="category"
            value={v.category_id}
            onChange={(e) => {
              set("category_id", e.target.value);
              setCatTouched(true);
              setHint(null);
            }}
            aria-invalid={!!errors.category_id}
          >
            <option value="">เลือกหมวดหมู่</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          {hint && v.category_id && <p className="mt-1 text-xs text-muted">{hint.reason}</p>}
          {errors.category_id && <p className="mt-1 text-xs text-expense">{errors.category_id}</p>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <Label htmlFor="pm" className="mb-1.5 block">
            ช่องทางชำระ
          </Label>
          <NativeSelect id="pm" value={v.payment_method} onChange={(e) => set("payment_method", e.target.value)}>
            <option value="">ไม่ระบุ</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
            {v.payment_method && !PAYMENT_METHODS.includes(v.payment_method as never) && <option>{v.payment_method}</option>}
          </NativeSelect>
        </div>
        <div className="min-w-0">
          <Label htmlFor="bank" className="mb-1.5 flex items-center gap-2">
            ธนาคาร <ReviewHint flag={flags?.bank} />
          </Label>
          <Input id="bank" value={v.bank} maxLength={60} onChange={(e) => set("bank", e.target.value)} className={fieldCls("bank")} />
        </div>
      </div>

      <div>
        <Label htmlFor="ref" className="mb-1.5 flex items-center gap-2">
          เลขอ้างอิงธุรกรรม <ReviewHint flag={flags?.reference_number} />
        </Label>
        <Input
          id="ref"
          value={v.reference_number}
          maxLength={64}
          autoComplete="off"
          onChange={(e) => set("reference_number", e.target.value.trim())}
          aria-invalid={!!errors.reference_number}
          className={cn("font-mono", fieldCls("reference_number"))}
        />
        {errors.reference_number && <p className="mt-1 text-xs text-expense">{errors.reference_number}</p>}
      </div>

      <div>
        <Label htmlFor="note" className="mb-1.5 block">
          หมายเหตุ
        </Label>
        <Textarea id="note" value={v.note} maxLength={500} onChange={(e) => set("note", e.target.value)} />
      </div>

      {dup && (
        <div
          role="alert"
          className={cn(
            "rounded-xl border p-3 text-sm",
            dup.level === "exact" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-4 shrink-0" /> {dup.message}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {dup.matches.slice(0, 3).map((m) => (
              <li key={m.id}>
                {formatThaiDate(m.transaction_date)} · {formatTHB(m.amount)} · {m.merchant_name ?? "-"}
                {m.reference_number ? ` · ${m.reference_number}` : ""}
              </li>
            ))}
          </ul>
          {dup.level === "possible" ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" loading={saving} onClick={() => submit(true)}>
              ไม่ใช่รายการซ้ำ บันทึกต่อ
            </Button>
          ) : (
            <p className="mt-2 text-xs">รายการนี้ถูกบันทึกไว้แล้ว ระบบจึงไม่บันทึกซ้ำ</p>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 flex gap-2 border-t border-border bg-surface px-5 pt-3 pb-1">
        {onCancel && (
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
        <Button type="submit" className="flex-1" loading={saving} disabled={dup?.level === "exact"}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
