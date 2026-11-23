"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/app/page-header";
import { api, useApi } from "@/lib/fetcher";
import { addMonths, endOfMonth, todayISO } from "@/lib/dates";
import { formatTHB } from "@/lib/utils";
import type { BudgetStatus } from "@/lib/summary";
import type { Category } from "@/lib/types";

const LEVEL: Record<BudgetStatus["level"], { label: string; variant: "income" | "warning" | "expense"; color?: string }> = {
  ok: { label: "ปกติ", variant: "income" },
  warning: { label: "ใกล้หมด", variant: "warning", color: "#D97706" },
  reached: { label: "ใช้ครบ 100%", variant: "expense", color: "#DC2626" },
  exceeded: { label: "เกินงบ", variant: "expense", color: "#DC2626" },
};

function monthLabel(m: string) {
  return new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-01T00:00:00Z`));
}

export function BudgetView() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const { data, error, loading, reload } = useApi<{ items: BudgetStatus[] }>(`/api/budgets?month=${month}`);
  const cats = useApi<{ items: Category[] }>("/api/categories");
  const expenseCats = useMemo(() => (cats.data?.items ?? []).filter((c) => c.type === "expense"), [cats.data]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetStatus | null>(null);
  const [deleting, setDeleting] = useState<BudgetStatus | null>(null);
  const [form, setForm] = useState({ category_id: "", amount: "", alert_threshold: "80" });
  const [saving, setSaving] = useState(false);

  const used = new Set((data?.items ?? []).map((b) => b.category_id ?? "__total"));

  function openNew() {
    setEditing(null);
    setForm({ category_id: used.has("__total") ? "" : "__total", amount: "", alert_threshold: "80" });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast.error("กรุณากรอกจำนวนงบมากกว่า 0");
    if (!editing && !form.category_id) return toast.error("กรุณาเลือกหมวดหมู่");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/budgets/${editing.id}`, { method: "PATCH", json: { amount, alert_threshold: Number(form.alert_threshold) } });
      } else {
        await api("/api/budgets", {
          method: "POST",
          json: {
            category_id: form.category_id === "__total" ? null : form.category_id,
            amount,
            alert_threshold: Number(form.alert_threshold),
            period_start: `${month}-01`,
            period_end: endOfMonth(`${month}-01`),
          },
        });
      }
      toast.success("บันทึกงบประมาณแล้ว");
      setOpen(false);
      void reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    try {
      await api(`/api/budgets/${deleting.id}`, { method: "DELETE" });
      toast.success("ลบงบประมาณแล้ว");
      setDeleting(null);
      void reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const total = data?.items.find((b) => !b.category_id);
  const perCat = data?.items.filter((b) => b.category_id) ?? [];
  const alerts = data?.items.filter((b) => b.level !== "ok") ?? [];

  return (
    <>
      <PageHeader
        title="งบประมาณ"
        description="ตั้งงบรายเดือน ระบบจะเตือนเมื่อใช้ถึงเกณฑ์ที่ตั้งไว้ (ค่าเริ่มต้น 80%)"
        actions={
          <Button onClick={openNew}>
            <Plus /> ตั้งงบ
          </Button>
        }
      />
      <div className="mb-4 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label="เดือนก่อน" onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}>
          <ChevronLeft />
        </Button>
        <span className="min-w-36 text-center font-medium">{monthLabel(month)}</span>
        <Button variant="outline" size="icon" aria-label="เดือนถัดไป" onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}>
          <ChevronRight />
        </Button>
      </div>

      {alerts.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm" role="status">
          <p className="flex items-center gap-2 font-semibold text-amber-800">
            <AlertTriangle className="size-4" /> มี {alerts.length} งบที่ต้องระวัง
          </p>
        </div>
      )}

      {error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <Card><LoadingState /></Card>
      ) : !data?.items.length ? (
        <Card>
          <EmptyState title="ยังไม่ได้ตั้งงบเดือนนี้" description="เริ่มจากตั้งงบรวม แล้วค่อยตั้งงบแยกหมวดที่อยากคุม เช่น อาหาร" action={<Button onClick={openNew}><Plus /> ตั้งงบ</Button>} />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {[...(total ? [total] : []), ...perCat].map((b) => {
            const lv = LEVEL[b.level];
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <span className="size-2.5 rounded-full" style={{ background: b.category_id ? b.color : "#2563EB" }} aria-hidden />
                      <span className="truncate">{b.categoryName}</span>
                      <Badge variant={lv.variant}>{lv.label}</Badge>
                    </p>
                    <p className="mt-1 text-sm text-muted tabular">
                      ใช้ไป {formatTHB(b.spent)} จาก {formatTHB(b.amount)}
                    </p>
                  </div>
                  <div className="flex shrink-0">
                    <Button variant="ghost" size="icon" aria-label="แก้ไขงบ" onClick={() => {
                      setEditing(b);
                      setForm({ category_id: b.category_id ?? "__total", amount: String(b.amount), alert_threshold: String(b.alertThreshold) });
                      setOpen(true);
                    }}>
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-expense" aria-label="ลบงบ" onClick={() => setDeleting(b)}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <Progress className="mt-3" value={b.percent} color={lv.color ?? (b.category_id ? b.color : "#2563EB")} />
                <div className="mt-2 flex justify-between text-sm tabular">
                  <span className={b.remaining < 0 ? "text-expense" : "text-muted"}>
                    {b.remaining < 0 ? `เกินงบ ${formatTHB(-b.remaining)}` : `คงเหลือ ${formatTHB(b.remaining)}`}
                  </span>
                  <span className="font-medium">ใช้งบแล้ว {b.percent}%</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={editing ? "แก้ไขงบประมาณ" : "ตั้งงบประมาณ"} description={monthLabel(month)}>
          <form onSubmit={save} className="flex flex-col gap-4">
            <div>
              <Label htmlFor="bcat" className="mb-1.5 block">หมวดหมู่</Label>
              <NativeSelect id="bcat" value={form.category_id} disabled={!!editing} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                <option value="">เลือก</option>
                <option value="__total" disabled={!editing && used.has("__total")}>งบรวมทุกหมวด</option>
                {expenseCats.map((c) => (
                  <option key={c.id} value={c.id} disabled={!editing && used.has(c.id)}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label htmlFor="bamt" className="mb-1.5 block">จำนวนงบ (บาท)</Label>
              <Input id="bamt" inputMode="decimal" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} placeholder="เช่น 5000" />
            </div>
            <div>
              <Label htmlFor="bth" className="mb-1.5 block">แจ้งเตือนเมื่อใช้ถึง (%)</Label>
              <NativeSelect id="bth" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })}>
                {[50, 60, 70, 80, 90, 100].map((n) => (
                  <option key={n} value={n}>{n}%</option>
                ))}
              </NativeSelect>
              <p className="mt-1 text-xs text-muted">ระบบจะเตือนอีกครั้งเมื่อใช้ครบ 100% และเมื่อใช้เกินงบ</p>
            </div>
            <Button type="submit" loading={saving}>บันทึก</Button>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบงบประมาณนี้?"
        description={deleting ? `${deleting.categoryName} · ${formatTHB(deleting.amount)} (รายการรายจ่ายจะไม่ถูกลบ)` : null}
        confirmLabel="ลบงบ"
        destructive
        loading={saving}
        onConfirm={remove}
      />
    </>
  );
}
