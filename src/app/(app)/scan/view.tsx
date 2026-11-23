"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, CheckCircle2, ImageUp, Info, RotateCcw, ScanLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { emptyForm, TransactionForm, type FieldFlags, type FormValues } from "@/components/app/transaction-form";
import { api, ApiClientError, useApi } from "@/lib/fetcher";
import { cn, formatTHB, formatThaiDate } from "@/lib/utils";
import type { ParsedSlip } from "@/lib/slip/parser";
import type { Category, Transaction } from "@/lib/types";
import { ACCEPTED, prepareImage, readQr } from "./image-utils";

type ScanResp = {
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

type ProfileResp = {
  profile: { account_names: string[]; ocr_consent_at: string | null };
  ocr: { id: string; label: string; external: boolean } | null;
};

type Stage = "pick" | "preview" | "scanning" | "review" | "saved";

const STEPS = ["ตรวจสอบไฟล์", "อ่านข้อความ (OCR)", "แยกข้อมูลธุรกรรม", "ตรวจรายการซ้ำ", "เสนอหมวดหมู่"];

function toForm(r: ScanResp): { values: FormValues; flags: FieldFlags } {
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

export function ScanView() {
  const [stage, setStage] = useState<Stage>("pick");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [saved, setSaved] = useState<Transaction | null>(null);
  const [consentBusy, setConsentBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const profile = useApi<ProfileResp>("/api/profile");
  const cats = useApi<{ items: Category[] }>("/api/categories");
  const needsConsent = !!profile.data?.ocr?.external && !profile.data?.profile.ocr_consent_at;
  const noOwnNames = profile.data && profile.data.profile.account_names.length === 0;

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  function reset() {
    setStage("pick");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setSaved(null);
    if (fileRef.current) fileRef.current.value = "";
    if (camRef.current) camRef.current.value = "";
  }

  async function onFile(f: File | undefined | null) {
    setError(null);
    if (!f) return;
    if (!ACCEPTED.includes(f.type) && !/\.(jpe?g|png|webp|heic)$/i.test(f.name)) {
      setError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP");
      return;
    }
    try {
      const ready = await prepareImage(f);
      setFile(ready);
      setPreview(URL.createObjectURL(ready));
      setStage("preview");
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function giveConsent() {
    setConsentBusy(true);
    try {
      await api("/api/profile", { method: "PATCH", json: { ocr_consent: true } });
      await profile.reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setConsentBusy(false);
    }
  }

  async function scan() {
    if (!file) return;
    setStage("scanning");
    setError(null);
    setStep(0);
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1200);
    try {
      const qr = await readQr(file);
      const fd = new FormData();
      fd.append("file", file);
      if (qr) fd.append("qr", qr);
      const r = await api<ScanResp>("/api/receipts/scan", { method: "POST", body: fd });
      setResult(r);
      setStage("review");
    } catch (e) {
      if (e instanceof ApiClientError && e.body.code === "consent_required") await profile.reload();
      setError((e as Error).message);
      setStage("preview");
    } finally {
      clearInterval(timer);
    }
  }

  const form = useMemo(() => (result ? toForm(result) : null), [result]);
  const p = result?.parsed;

  return (
    <>
      <PageHeader title="สแกนสลิป" description="อัปโหลดหรือถ่ายรูปสลิป ระบบจะอ่านข้อมูลให้ คุณตรวจและยืนยันก่อนบันทึก" />

      {profile.data && !profile.data.ocr && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm" role="status">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>ยังไม่ได้ตั้งค่าบริการ OCR ระบบจะเก็บรูปสลิปไว้ และให้คุณกรอกข้อมูลเองได้</p>
        </div>
      )}
      {noOwnNames && stage !== "saved" && (
        <div className="mb-4 flex gap-2 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm" role="status">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            เพิ่ม <Link href="/settings" className="font-medium text-primary underline">ชื่อบัญชีธนาคารของคุณ</Link> ในหน้าตั้งค่า
            เพื่อให้ระบบบอกได้ว่าสลิปเป็นรายรับหรือรายจ่าย
          </p>
        </div>
      )}

      {stage === "saved" && saved ? (
        <Card className="mx-auto max-w-md p-6 text-center">
          <CheckCircle2 className="mx-auto size-12 text-income" />
          <h2 className="mt-3 text-lg font-semibold">บันทึกรายการแล้ว</h2>
          <p className="mt-1 text-sm text-muted">
            {saved.merchant_name ?? "รายการ"} · {formatTHB(saved.amount)} · {formatThaiDate(saved.transaction_date)}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={reset}>
              <ScanLine /> สแกนสลิปถัดไป
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">ไปหน้าหลัก</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>รูปสลิป</CardTitle>
              <CardDescription>JPG, PNG หรือ WEBP ไม่เกิน 5 MB</CardDescription>
            </CardHeader>
            <CardContent>
              {stage === "pick" ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    void onFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border px-4 py-10 text-center",
                    dragging && "border-primary bg-blue-50",
                  )}
                >
                  <ImageUp className="size-10 text-slate-300" aria-hidden />
                  <p className="text-sm text-muted">ลากรูปมาวาง หรือเลือกจากเครื่อง</p>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button onClick={() => fileRef.current?.click()}>
                      <ImageUp /> เลือกรูปสลิป
                    </Button>
                    <Button variant="outline" onClick={() => camRef.current?.click()}>
                      <Camera /> ถ่ายรูป
                    </Button>
                  </div>
                </div>
              ) : (
                preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="ตัวอย่างรูปสลิป" className="mx-auto max-h-[28rem] w-auto max-w-full rounded-xl border border-border object-contain" />
                )
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />
              <input ref={camRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFile(e.target.files?.[0])} />

              {error && (
                <p className="mt-3 flex items-center gap-2 text-sm text-expense" role="alert">
                  <AlertTriangle className="size-4 shrink-0" /> {error}
                </p>
              )}

              {stage === "preview" && needsConsent && (
                <div className="mt-4 rounded-xl border border-border bg-slate-50 p-3 text-sm">
                  <p className="flex items-center gap-2 font-medium">
                    <ShieldCheck className="size-4 text-primary" /> ขอความยินยอมก่อนอ่านสลิป
                  </p>
                  <p className="mt-1 text-muted">
                    ระบบจะส่งรูปสลิปไปยัง {profile.data?.ocr?.label} เพื่ออ่านข้อความเท่านั้น ไม่ใช้เพื่อวัตถุประสงค์อื่น
                    ดูรายละเอียดใน <Link href="/privacy" className="text-primary underline" target="_blank">นโยบายความเป็นส่วนตัว</Link>
                  </p>
                  <Button size="sm" className="mt-3" loading={consentBusy} onClick={giveConsent}>
                    ยินยอมและดำเนินการต่อ
                  </Button>
                </div>
              )}

              {(stage === "preview" || stage === "scanning") && (
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button className="flex-1" onClick={scan} loading={stage === "scanning"} disabled={needsConsent}>
                    <ScanLine /> {profile.data?.ocr ? "อ่านข้อมูลจากสลิป" : "อัปโหลดและกรอกเอง"}
                  </Button>
                  <Button variant="outline" onClick={reset} disabled={stage === "scanning"}>
                    <RotateCcw /> เลือกรูปใหม่
                  </Button>
                </div>
              )}

              {stage === "scanning" && (
                <ol className="mt-4 space-y-1.5 text-sm" aria-live="polite">
                  {STEPS.map((s, i) => (
                    <li key={s} className={cn("flex items-center gap-2", i > step ? "text-slate-300" : i === step ? "text-primary" : "text-muted")}>
                      <span className={cn("size-2 rounded-full", i < step ? "bg-income" : i === step ? "animate-pulse bg-primary" : "bg-slate-200")} />
                      {s}
                    </li>
                  ))}
                </ol>
              )}

              {stage === "review" && result?.raw_text && (
                <details className="mt-4 text-sm">
                  <summary className="cursor-pointer text-muted">ข้อความที่ระบบอ่านได้ ({result.provider})</summary>
                  <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 text-xs">{result.raw_text}</pre>
                </details>
              )}
            </CardContent>
          </Card>

          {stage === "review" && result && form && (
            <Card>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  ตรวจสอบข้อมูลก่อนบันทึก
                  {p && (
                    <Badge variant={p.needsReview ? "warning" : "income"}>
                      {p.needsReview ? "ต้องตรวจสอบ" : "อ่านได้ครบ"} · มั่นใจ {Math.round(p.overallConfidence * 100)}%
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>ช่องสีเหลืองคือข้อมูลที่ระบบไม่แน่ใจ กรุณาตรวจและแก้ให้ถูกต้อง</CardDescription>
              </CardHeader>
              <CardContent>
                {result.message && (
                  <p className="mb-3 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                    <AlertTriangle className="size-4 shrink-0" /> {result.message}
                  </p>
                )}
                {result.duplicate && (
                  <div className={cn("mb-3 rounded-xl border p-3 text-sm", result.duplicate.level === "exact" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50")} role="alert">
                    <p className="flex items-center gap-2 font-medium">
                      <AlertTriangle className="size-4 shrink-0" /> {result.duplicate.reason}
                    </p>
                    <ul className="mt-1 text-xs text-muted">
                      {result.duplicate.matches.slice(0, 3).map((m) => (
                        <li key={m.id}>
                          {formatThaiDate(m.transaction_date)} · {formatTHB(m.amount)} · {m.merchant_name ?? "-"}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {p && p.warnings.length > 0 && (
                  <ul className="mb-3 list-disc space-y-0.5 pl-5 text-xs text-amber-800">
                    {p.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                )}
                {p && (
                  <dl className="mb-4 grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs">
                    <dt className="text-muted">ผู้โอน</dt>
                    <dd className="truncate">{p.senderName.value ?? "อ่านไม่พบ"}</dd>
                    <dt className="text-muted">ผู้รับ</dt>
                    <dd className="truncate">{p.receiverName.value ?? "อ่านไม่พบ"}</dd>
                    {p.fee !== null && (
                      <>
                        <dt className="text-muted">ค่าธรรมเนียม</dt>
                        <dd>{formatTHB(p.fee)}</dd>
                      </>
                    )}
                    <dt className="col-span-2 mt-1 text-muted">{p.suggestedType.reason}</dt>
                  </dl>
                )}
                <TransactionForm
                  key={result.receipt_id}
                  categories={cats.data?.items ?? []}
                  initial={form.values}
                  flags={form.flags}
                  receiptId={result.receipt_id}
                  source="ocr"
                  categoryHint={result.category?.categoryId ? { confidence: result.category.confidence, reason: result.category.reason } : null}
                  extra={{ sender_name: p?.senderName.value ?? null, receiver_name: p?.receiverName.value ?? null }}
                  submitLabel="ยืนยันและบันทึก"
                  onCancel={reset}
                  onSaved={(t) => {
                    setSaved(t);
                    setStage("saved");
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
