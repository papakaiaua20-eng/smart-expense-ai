"use client";
import { useRef, useState } from "react";
import { FileUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/fetcher";
import { formatNumber, formatTHB, formatThaiDate } from "@/lib/utils";

type Summary = {
  total_in_file: number;
  to_import: number;
  already_imported: number;
  skipped: { reason: string; count: number }[];
  new_categories: string[];
  date_from: string | null;
  date_to: string | null;
  income: number;
  expense: number;
  budgets: number;
  imported?: number;
  categories_created?: number;
  budgets_created?: number;
};

/** Import a backup (.json) from the old "บัญชีออฟฟิศ" app. Preview first, then import. */
export function ImportOfficeLedger() {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<Summary | null>(null);
  const [done, setDone] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f: File | undefined) {
    if (!f) return;
    setError(null);
    setPreview(null);
    setDone(null);
    setFileName(f.name);
    setBusy(true);
    try {
      const t = await f.text();
      setText(t);
      setPreview(await api<Summary>("/api/import/office-ledger?dry_run=1", { method: "POST", body: t, headers: { "Content-Type": "application/json" } }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function run() {
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<Summary>("/api/import/office-ledger", { method: "POST", body: text, headers: { "Content-Type": "application/json" } });
      setDone(r);
      setPreview(null);
      toast.success(`นำเข้าแล้ว ${formatNumber(r.imported ?? 0)} รายการ`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>นำเข้าข้อมูลจากบัญชีออฟฟิศ</CardTitle>
        <CardDescription>
          เลือกไฟล์ .json จากปุ่ม “สำรอง / กู้คืน → ดาวน์โหลดไฟล์สำรอง” ของแอปบัญชีออฟฟิศ หมวด ธนาคาร วิธีจ่าย แท็ก และงบรายเดือนจะย้ายมาด้วย
          นำเข้าซ้ำได้ รายการเดิมจะไม่ถูกเพิ่มซ้ำ
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
        <Button variant="outline" onClick={() => input.current?.click()} loading={busy && !preview}>
          <FileUp /> เลือกไฟล์สำรอง (.json)
        </Button>
        {error && <p className="text-sm text-expense" role="alert">{error}</p>}

        {preview && (
          <div className="rounded-xl border border-border bg-slate-50 p-4 text-sm">
            <p className="font-medium">{fileName}</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>
                พบ {formatNumber(preview.total_in_file)} รายการ
                {preview.date_from && ` · ${formatThaiDate(preview.date_from)} – ${formatThaiDate(preview.date_to)}`}
              </li>
              <li className="text-foreground">
                จะนำเข้า <b>{formatNumber(preview.to_import)}</b> รายการ (รายจ่าย {formatTHB(preview.expense)}, รายรับ {formatTHB(preview.income)})
              </li>
              {preview.already_imported > 0 && <li>เคยนำเข้าแล้ว {formatNumber(preview.already_imported)} รายการ (จะข้าม)</li>}
              {preview.skipped.map((s) => (
                <li key={s.reason}>ข้าม {s.count} รายการ: {s.reason}</li>
              ))}
              {preview.new_categories.length > 0 && <li>สร้างหมวดใหม่: {preview.new_categories.join(", ")}</li>}
              {preview.budgets > 0 && <li>งบรายเดือน {preview.budgets} รายการ จะตั้งเป็นงบของเดือนนี้</li>}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={run} loading={busy} disabled={preview.to_import === 0 && preview.budgets === 0}>
                ยืนยันนำเข้า
              </Button>
              <Button variant="ghost" onClick={() => setPreview(null)} disabled={busy}>
                ยกเลิก
              </Button>
            </div>
          </div>
        )}

        {done && (
          <p className="rounded-xl bg-green-50 p-3 text-sm text-income" role="status">
            นำเข้าแล้ว {formatNumber(done.imported ?? 0)} รายการ
            {done.categories_created ? ` · สร้างหมวดใหม่ ${done.categories_created} หมวด` : ""}
            {done.budgets_created ? ` · ตั้งงบ ${done.budgets_created} รายการ` : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
