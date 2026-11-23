"use client";
// Scan several slips at once: each image is sent in its own request (keeps every request far below
// Vercel's body/time limits), then the user reviews all results in one list and saves them together.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, ChevronDown, Loader2, RotateCcw, Save, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type FieldFlags, type FormValues } from "@/components/app/transaction-form";
import { api, ApiClientError } from "@/lib/fetcher";
import { cn, formatTHB } from "@/lib/utils";
import type { Category, TxType } from "@/lib/types";
import { prepareImage, readQr } from "./image-utils";
import { toForm, type ScanResp } from "./scan-shared";

export const MAX_BATCH = 20;

type Status = "queued" | "scanning" | "ready" | "failed" | "saving" | "saved" | "error";

type Item = {
  key: string;
  name: string;
  file: File | null;
  preview: string | null;
  status: Status;
  message: string | null;
  resp: ScanResp | null;
  values: FormValues;
  flags: FieldFlags;
  include: boolean;
  warn: { level: "exact" | "possible" | "batch"; text: string } | null;
  errors: Partial<Record<keyof FormValues, string>>;
  open: boolean;
};

const blankValues: FormValues = {
  type: "expense",
  amount: "",
  transaction_date: "",
  transaction_time: "",
  category_id: "",
  merchant_name: "",
  payment_method: "",
  bank: "",
  reference_number: "",
  note: "",
};

function validate(v: FormValues) {
  const e: Item["errors"] = {};
  if (!v.type) e.type = "เลือกประเภท";
  const amt = Number(v.amount);
  if (!v.amount || !Number.isFinite(amt) || amt <= 0) e.amount = "กรอกจำนวนเงิน";
  if (!v.transaction_date) e.transaction_date = "เลือกวันที่";
  if (v.type !== "transfer" && !v.category_id) e.category_id = "เลือกหมวด";
  if (v.reference_number && !/^[A-Za-z0-9-]+$/.test(v.reference_number)) e.reference_number = "ตัวอักษรอังกฤษ/ตัวเลขเท่านั้น";
  return e;
}

/** Mark later slips in the same batch that look like an earlier one (same ref+amount, or same amount+date+time). */
function batchDuplicates(items: Item[]): Map<string, number> {
  const out = new Map<string, number>();
  items.forEach((it, i) => {
    if (!it.resp || it.status === "failed") return;
    const v = it.values;
    for (let j = 0; j < i; j++) {
      const w = items[j].values;
      if (!items[j].resp || v.amount === "" || Number(v.amount) !== Number(w.amount)) continue;
      const sameRef = v.reference_number && v.reference_number === w.reference_number;
      const sameWhen = v.transaction_date && v.transaction_date === w.transaction_date && v.transaction_time && v.transaction_time === w.transaction_time;
      if (sameRef || sameWhen) {
        out.set(it.key, j + 1);
        return;
      }
    }
  });
  return out;
}

export function BatchScan({
  files,
  categories,
  blocked,
  onExit,
}: {
  files: File[];
  categories: Category[];
  blocked: boolean;
  onExit: () => void;
}) {
  const [items, setItems] = useState<Item[]>(() =>
    files.slice(0, MAX_BATCH).map((f, i) => ({
      key: `${i}-${f.name}-${f.size}`,
      name: f.name,
      file: null,
      preview: null,
      status: "queued",
      message: null,
      resp: null,
      values: blankValues,
      flags: {},
      include: false,
      warn: null,
      errors: {},
      open: false,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ saved: number; failed: number } | null>(null);
  const started = useRef(false);
  const previews = useRef<string[]>([]);

  const patch = (key: string, p: Partial<Item> | ((it: Item) => Partial<Item>)) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...(typeof p === "function" ? p(it) : p) } : it)));

  // free object URLs when leaving
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // scan one by one
  useEffect(() => {
    if (blocked || started.current) return;
    started.current = true;
    const list = files.slice(0, MAX_BATCH);
    (async () => {
      for (let i = 0; i < list.length; i++) {
        const key = `${i}-${list[i].name}-${list[i].size}`;
        patch(key, { status: "scanning" });
        try {
          const file = await prepareImage(list[i]);
          const url = URL.createObjectURL(file);
          previews.current.push(url);
          patch(key, { file, preview: url });
          const qr = await readQr(file);
          const fd = new FormData();
          fd.append("file", file);
          if (qr) fd.append("qr", qr);
          const r = await api<ScanResp>("/api/receipts/scan", { method: "POST", body: fd });
          const f = toForm(r);
          const values = { ...blankValues, ...f.values, type: f.values.type || "expense" } as FormValues;
          const dupExact = r.duplicate?.level === "exact";
          const dupPossible = r.duplicate && !dupExact;
          const readable = !!r.parsed && r.status !== "failed";
          patch(key, {
            status: readable ? "ready" : "failed",
            resp: r,
            values,
            flags: f.flags,
            message: r.message,
            include: readable && !r.duplicate,
            warn: r.duplicate
              ? { level: dupExact ? "exact" : "possible", text: r.duplicate.reason ?? (dupPossible ? "อาจซ้ำกับรายการที่มีอยู่" : "ซ้ำกับรายการที่มีอยู่") }
              : null,
            open: !readable,
          });
        } catch (e) {
          patch(key, { status: "error", message: (e as Error).message, include: false, open: false });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked]);

  const inBatchDup = useMemo(() => batchDuplicates(items), [items]);

  // a slip that repeats an earlier one in this batch starts unticked
  useEffect(() => {
    setItems((list) =>
      list.map((it) =>
        inBatchDup.has(it.key) && it.warn?.level !== "batch" && it.status === "ready"
          ? { ...it, include: false, warn: { level: "batch", text: `ซ้ำกับสลิปใบที่ ${inBatchDup.get(it.key)} ในชุดนี้` } }
          : it,
      ),
    );
  }, [inBatchDup]);

  const scanning = items.some((it) => it.status === "queued" || it.status === "scanning");
  const scannedCount = items.filter((it) => !["queued", "scanning"].includes(it.status)).length;
  const selected = items.filter((it) => it.include && it.status !== "saved");
  const selectedTotal = selected.reduce(
    (a, it) => {
      const n = Math.round(Number(it.values.amount || 0) * 100);
      if (it.values.type === "income") a.income += n;
      else if (it.values.type === "expense") a.expense += n;
      return a;
    },
    { income: 0, expense: 0 },
  );

  function setValue<K extends keyof FormValues>(it: Item, k: K, val: FormValues[K]) {
    patch(it.key, (cur) => ({ values: { ...cur.values, [k]: val }, errors: { ...cur.errors, [k]: undefined } }));
  }

  async function changeType(it: Item, t: TxType) {
    patch(it.key, (cur) => ({ values: { ...cur.values, type: t, category_id: "" }, errors: {} }));
    if (t === "transfer" || !it.values.merchant_name.trim()) return;
    try {
      const s = await api<{ categoryId: string | null }>("/api/categories/suggest", {
        method: "POST",
        json: { merchant: it.values.merchant_name, type: t },
      });
      if (s.categoryId) patch(it.key, (cur) => ({ values: { ...cur.values, category_id: s.categoryId! } }));
    } catch {
      /* optional */
    }
  }

  async function saveAll() {
    const todo = items.filter((it) => it.include && it.status !== "saved");
    let bad = 0;
    for (const it of todo) {
      const e = validate(it.values);
      if (Object.keys(e).length) {
        bad++;
        patch(it.key, { errors: e, open: true });
      }
    }
    if (bad) {
      toast.error(`มี ${bad} ใบที่ข้อมูลยังไม่ครบ กรุณาแก้ช่องสีแดงก่อน`);
      return;
    }
    setSaving(true);
    let saved = 0;
    let failed = 0;
    for (const it of todo) {
      patch(it.key, { status: "saving" });
      const v = it.values;
      const p = it.resp?.parsed;
      try {
        await api("/api/transactions", {
          method: "POST",
          json: {
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
            source: "ocr",
            receipt_id: it.resp?.receipt_id ?? null,
            sender_name: p?.senderName.value ?? null,
            receiver_name: p?.receiverName.value ?? null,
            // the user ticked this slip after seeing the "possible duplicate" warning
            confirm_duplicate: true,
          },
        });
        saved++;
        patch(it.key, { status: "saved", include: false, open: false });
      } catch (e) {
        failed++;
        const dup = e instanceof ApiClientError && e.status === 409;
        patch(it.key, {
          status: "error",
          include: false,
          message: dup ? `ไม่ได้บันทึก: ${e.message}` : (e as Error).message,
          open: true,
        });
      }
    }
    setSaving(false);
    setDone({ saved, failed });
    if (saved) toast.success(`บันทึกแล้ว ${saved} รายการ`);
  }

  const catsFor = (t: FormValues["type"]) => categories.filter((c) => (t === "income" ? c.type === "income" : c.type === "expense"));

  return (
    <div className="space-y-3 pb-28">
      <Card className="flex flex-wrap items-center justify-between gap-2 p-4">
        <div>
          <p className="font-semibold">สแกนหลายสลิป ({items.length} ใบ)</p>
          <p className="text-sm text-muted">
            {blocked
              ? "กรุณากดยินยอมด้านบนก่อน ระบบจึงจะเริ่มอ่านสลิป"
              : scanning
                ? `กำลังอ่านสลิป ${scannedCount + 1}/${items.length} …`
                : "ตรวจและแก้แต่ละใบ ติ๊กใบที่ต้องการ แล้วกด บันทึกทั้งหมด"}
          </p>
          {files.length > MAX_BATCH && (
            <p className="text-xs text-amber-700">เลือกได้ครั้งละไม่เกิน {MAX_BATCH} รูป ระบบใช้ {MAX_BATCH} รูปแรก</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={onExit} disabled={saving}>
          <RotateCcw /> เริ่มใหม่
        </Button>
      </Card>

      {done && (
        <Card className="p-4 text-sm" role="status">
          <p className="flex items-center gap-2 font-medium">
            <CheckCircle2 className="size-4 text-income" /> บันทึกสำเร็จ {done.saved} รายการ
            {done.failed > 0 && <span className="text-expense">· ไม่สำเร็จ {done.failed} รายการ (ดูเหตุผลที่ใบนั้น)</span>}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={onExit}>
              สแกนชุดใหม่
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/transactions">ดูประวัติรายการ</Link>
            </Button>
          </div>
        </Card>
      )}

      <ul className="space-y-3">
        {items.map((it, idx) => {
          const v = it.values;
          const editable = it.status === "ready" || it.status === "failed" || (it.status === "error" && !!it.resp);
          const flag = (k: keyof FormValues) => (it.flags[k] === "review" || it.flags[k] === "missing" ? "border-amber-400 bg-amber-50/60" : "");
          const err = (k: keyof FormValues) => (it.errors[k] ? "border-expense" : "");
          return (
            <li key={it.key}>
              <Card className={cn("p-3", it.status === "saved" && "opacity-70")}>
                <div className="flex gap-3">
                  <div className="w-16 shrink-0 sm:w-20">
                    {it.preview ? (
                      <a href={it.preview} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={it.preview} alt={`สลิปใบที่ ${idx + 1}`} className="h-24 w-full rounded-lg border border-border object-cover object-top sm:h-28" />
                      </a>
                    ) : (
                      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted sm:h-28">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {editable && (
                        <label className="flex items-center gap-1.5 text-sm font-medium">
                          <input
                            type="checkbox"
                            className="size-4 accent-primary"
                            checked={it.include}
                            disabled={saving}
                            onChange={(e) => patch(it.key, { include: e.target.checked })}
                          />
                          ใบที่ {idx + 1}
                        </label>
                      )}
                      {!editable && <span className="text-sm font-medium">ใบที่ {idx + 1}</span>}
                      <StatusBadge it={it} />
                    </div>

                    {it.status === "scanning" || it.status === "queued" ? (
                      <p className="truncate text-xs text-muted">{it.name}</p>
                    ) : null}

                    {it.warn && it.status !== "saved" && (
                      <p className={cn("flex items-start gap-1.5 rounded-lg p-2 text-xs", it.warn.level === "possible" ? "bg-amber-50 text-amber-900" : "bg-red-50 text-red-800")}>
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {it.warn.text}
                          {it.warn.level === "possible" && " · ถ้าแน่ใจว่าไม่ซ้ำ ให้ติ๊กเพื่อบันทึก"}
                        </span>
                      </p>
                    )}
                    {it.message && it.status !== "saved" && (
                      <p className={cn("text-xs", it.status === "error" ? "text-expense" : "text-amber-800")}>{it.message}</p>
                    )}

                    {editable && (
                      <>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          <div className="col-span-2 sm:col-span-1">
                            <Label className="sr-only">ประเภท</Label>
                            <NativeSelect value={v.type} disabled={saving} onChange={(e) => changeType(it, e.target.value as TxType)} className={cn("h-10", flag("type"), err("type"))}>
                              <option value="expense">รายจ่าย</option>
                              <option value="income">รายรับ</option>
                              <option value="transfer">โอนระหว่างบัญชี</option>
                            </NativeSelect>
                          </div>
                          <div>
                            <Label className="sr-only">จำนวนเงิน</Label>
                            <Input inputMode="decimal" placeholder="จำนวนเงิน" value={v.amount} disabled={saving} onChange={(e) => setValue(it, "amount", e.target.value.replace(/[^\d.]/g, ""))} className={cn("h-10", flag("amount"), err("amount"))} />
                          </div>
                          <div>
                            <Label className="sr-only">วันที่</Label>
                            <Input type="date" value={v.transaction_date} disabled={saving} onChange={(e) => setValue(it, "transaction_date", e.target.value)} className={cn("h-10", flag("transaction_date"), err("transaction_date"))} />
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <Label className="sr-only">หมวดหมู่</Label>
                            <NativeSelect value={v.category_id} disabled={saving || v.type === "transfer"} onChange={(e) => setValue(it, "category_id", e.target.value)} className={cn("h-10", err("category_id"))}>
                              <option value="">{v.type === "transfer" ? "ไม่ต้องเลือกหมวด" : "เลือกหมวดหมู่"}</option>
                              {catsFor(v.type).map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                        </div>
                        <Input placeholder="ร้านค้า / ผู้รับ / ผู้โอน" value={v.merchant_name} disabled={saving} onChange={(e) => setValue(it, "merchant_name", e.target.value)} className={cn("h-10", flag("merchant_name"))} />
                        {Object.values(it.errors).some(Boolean) && (
                          <p className="text-xs text-expense">{Object.values(it.errors).filter(Boolean).join(" · ")}</p>
                        )}
                        <button type="button" className="flex items-center gap-1 text-xs text-primary" onClick={() => patch(it.key, { open: !it.open })}>
                          <ChevronDown className={cn("size-3.5 transition-transform", it.open && "rotate-180")} /> เวลา ธนาคาร เลขอ้างอิง หมายเหตุ
                        </button>
                        {it.open && (
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <Input type="time" value={v.transaction_time} disabled={saving} onChange={(e) => setValue(it, "transaction_time", e.target.value)} className={cn("h-10", flag("transaction_time"))} aria-label="เวลา" />
                            <Input placeholder="ธนาคาร" value={v.bank} disabled={saving} onChange={(e) => setValue(it, "bank", e.target.value)} className={cn("h-10", flag("bank"))} />
                            <Input placeholder="เลขอ้างอิง" value={v.reference_number} disabled={saving} onChange={(e) => setValue(it, "reference_number", e.target.value.trim())} className={cn("col-span-2 h-10", flag("reference_number"), err("reference_number"))} />
                            <Input placeholder="หมายเหตุ" value={v.note} disabled={saving} onChange={(e) => setValue(it, "note", e.target.value)} className="col-span-2 h-10 sm:col-span-4" />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-medium">เลือกไว้ {selected.length} ใบ</p>
            <p className="truncate text-xs text-muted">
              {selectedTotal.expense > 0 && <span className="text-expense">จ่าย {formatTHB(selectedTotal.expense / 100)} </span>}
              {selectedTotal.income > 0 && <span className="text-income">รับ {formatTHB(selectedTotal.income / 100)}</span>}
            </p>
          </div>
          <Button onClick={saveAll} loading={saving} disabled={scanning || saving || selected.length === 0}>
            <Save /> บันทึกทั้งหมด{selected.length ? ` (${selected.length})` : ""}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ it }: { it: Item }) {
  switch (it.status) {
    case "queued":
      return <Badge variant="outline">รอคิว</Badge>;
    case "scanning":
      return (
        <Badge>
          <Loader2 className="mr-1 inline size-3 animate-spin" /> กำลังอ่าน
        </Badge>
      );
    case "ready":
      return it.resp?.parsed?.needsReview ? <Badge variant="warning">ต้องตรวจสอบ</Badge> : <Badge variant="income">อ่านได้ครบ</Badge>;
    case "failed":
      return <Badge variant="warning">อ่านไม่ได้ กรอกเอง</Badge>;
    case "saving":
      return (
        <Badge>
          <Loader2 className="mr-1 inline size-3 animate-spin" /> กำลังบันทึก
        </Badge>
      );
    case "saved":
      return (
        <Badge variant="income">
          <CheckCircle2 className="mr-1 inline size-3" /> บันทึกแล้ว
        </Badge>
      );
    case "error":
      return (
        <Badge variant="expense">
          <XCircle className="mr-1 inline size-3" /> ไม่สำเร็จ
        </Badge>
      );
  }
}
