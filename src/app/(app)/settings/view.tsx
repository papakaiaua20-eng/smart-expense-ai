"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogOut, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/app/page-header";
import { ImportOfficeLedger } from "@/components/app/import-office";
import { ThemeSelect } from "@/components/app/theme";
import { api, useApi } from "@/lib/fetcher";
import type { Category } from "@/lib/types";

type ProfileResp = {
  profile: {
    email: string;
    display_name: string | null;
    account_names: string[];
    keep_receipt_images: boolean;
    ocr_consent_at: string | null;
    budget_alert_enabled: boolean;
  };
  ocr: { id: string; label: string; external: boolean } | null;
};

const COLORS = ["#F97316", "#0EA5E9", "#EC4899", "#8B5CF6", "#EAB308", "#EF4444", "#6366F1", "#14B8A6", "#16A34A", "#64748B"];

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full bg-slate-200 transition peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-ring after:absolute after:left-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" aria-hidden />
    </label>
  );
}

export function SettingsView() {
  const prof = useApi<ProfileResp>("/api/profile");
  const cats = useApi<{ items: Category[] }>("/api/categories");
  const [displayName, setDisplayName] = useState("");
  const [names, setNames] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", type: "expense", color: COLORS[0] });
  const [delCat, setDelCat] = useState<Category | null>(null);
  const [wipe, setWipe] = useState<null | "images" | "data" | "account">(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (prof.data) {
      setDisplayName(prof.data.profile.display_name ?? "");
      setNames(prof.data.profile.account_names ?? []);
    }
  }, [prof.data]);

  async function patch(body: Record<string, unknown>, msg = "บันทึกแล้ว") {
    try {
      await api("/api/profile", { method: "PATCH", json: body });
      toast.success(msg);
      await prof.reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const all = newName.trim() ? [...names, newName.trim()] : names;
    await patch({ display_name: displayName, account_names: all });
    setNewName("");
    setSaving(false);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCat.name.trim()) return;
    try {
      await api("/api/categories", { method: "POST", json: newCat });
      toast.success("เพิ่มหมวดหมู่แล้ว");
      setNewCat({ ...newCat, name: "" });
      void cats.reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function removeCategory() {
    if (!delCat) return;
    setBusy(true);
    try {
      await api(`/api/categories/${delCat.id}`, { method: "DELETE" });
      toast.success("ลบหมวดหมู่แล้ว");
      setDelCat(null);
      void cats.reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doWipe() {
    setBusy(true);
    try {
      if (wipe === "images") {
        const r = await api<{ deleted: number }>("/api/receipts", { method: "DELETE" });
        toast.success(`ลบรูปสลิปแล้ว ${r.deleted} รูป`);
      } else {
        await api("/api/account", { method: "DELETE", json: { confirm: confirmText, delete_account: wipe === "account" } });
        toast.success(wipe === "account" ? "ลบบัญชีแล้ว" : "ลบข้อมูลการเงินทั้งหมดแล้ว");
        if (wipe === "account") window.location.href = "/";
      }
      setWipe(null);
      setConfirmText("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!prof.data) return <LoadingState />;
  const p = prof.data.profile;

  return (
    <>
      <PageHeader title="ตั้งค่า" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ข้อมูลส่วนตัว</CardTitle>
            <CardDescription>{p.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="flex flex-col gap-4">
              <div>
                <Label htmlFor="dn" className="mb-1.5 block">ชื่อที่แสดง</Label>
                <Input id="dn" value={displayName} maxLength={80} onChange={(e) => setDisplayName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="an" className="mb-1.5 block">ชื่อบัญชีธนาคารของฉัน</Label>
                <p className="mb-2 text-xs text-muted">
                  ใช้แยกว่าสลิปเป็นรายรับหรือรายจ่าย: ถ้าชื่อผู้โอนตรงกับชื่อนี้ = รายจ่าย, ผู้รับตรง = รายรับ, ตรงทั้งคู่ = โอนระหว่างบัญชี
                  ใส่ได้ทั้งไทยและอังกฤษ เช่น “สมชาย ใจดี”, “SOMCHAI JAIDEE”
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {names.map((n) => (
                    <Badge key={n} variant="default" className="py-1">
                      {n}
                      <button type="button" aria-label={`ลบ ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input id="an" value={newName} placeholder="ชื่อ-นามสกุล ตามบัญชี" onChange={(e) => setNewName(e.target.value)} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newName.trim().length >= 2 && !names.includes(newName.trim())) setNames([...names, newName.trim()]);
                      setNewName("");
                    }}
                  >
                    <Plus /> เพิ่ม
                  </Button>
                </div>
              </div>
              <Button type="submit" loading={saving}>บันทึกข้อมูลส่วนตัว</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>การแสดงผล ความเป็นส่วนตัว และการแจ้งเตือน</CardTitle>
            <CardDescription>
              บริการอ่านสลิป: {prof.data.ocr ? `${prof.data.ocr.label}${prof.data.ocr.external ? " (ส่งรูปไปยังผู้ให้บริการภายนอก)" : ""}` : "ยังไม่ได้ตั้งค่า"}
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            <div className="pb-3">
              <p className="mb-2 text-sm font-medium">ธีมสี</p>
              <ThemeSelect />
            </div>
            <Toggle
              checked={p.budget_alert_enabled}
              onChange={(v) => patch({ budget_alert_enabled: v })}
              label="แจ้งเตือนงบประมาณ"
              description="แสดงคำเตือนเมื่อใช้งบถึงเกณฑ์ 100% หรือเกินงบ"
            />
            <Toggle
              checked={p.keep_receipt_images}
              onChange={(v) => patch({ keep_receipt_images: v })}
              label="เก็บรูปสลิปหลังบันทึก"
              description="ถ้าปิด ระบบจะลบรูปสลิปทันทีหลังบันทึกรายการ (เก็บเฉพาะข้อมูลตัวเลข)"
            />
            {prof.data.ocr?.external && (
              <Toggle
                checked={!!p.ocr_consent_at}
                onChange={(v) => patch({ ocr_consent: v })}
                label="ยินยอมให้ส่งรูปสลิปไปอ่านข้อความ"
                description={`รูปจะถูกส่งไปยัง ${prof.data.ocr.label} เพื่ออ่านข้อความเท่านั้น`}
              />
            )}
            <p className="pt-3 text-xs text-muted">
              อ่าน <Link href="/privacy" className="text-primary underline">นโยบายความเป็นส่วนตัว</Link>
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>หมวดหมู่</CardTitle>
            <CardDescription>เพิ่มหมวดของคุณเองได้ ถ้าลบหมวด รายการเดิมจะยังอยู่แต่แสดงเป็น “ไม่ระบุหมวดหมู่”</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={addCategory} className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
              <Input className="col-span-2 sm:col-span-1" aria-label="ชื่อหมวดหมู่ใหม่" placeholder="ชื่อหมวดหมู่ใหม่" value={newCat.name} maxLength={60} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} />
              <NativeSelect aria-label="ประเภทหมวด" className="sm:w-32" value={newCat.type} onChange={(e) => setNewCat({ ...newCat, type: e.target.value })}>
                <option value="expense">รายจ่าย</option>
                <option value="income">รายรับ</option>
              </NativeSelect>
              <NativeSelect aria-label="สี" className="sm:w-28" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} style={{ color: newCat.color }}>
                {COLORS.map((c) => (
                  <option key={c} value={c} style={{ color: c }}>● {c}</option>
                ))}
              </NativeSelect>
              <Button type="submit" className="col-span-2 sm:col-span-1"><Plus /> เพิ่ม</Button>
            </form>
            {(["expense", "income"] as const).map((t) => (
              <div key={t} className="mb-3">
                <p className="mb-2 text-xs font-medium text-muted">{t === "expense" ? "รายจ่าย" : "รายรับ"}</p>
                <div className="flex flex-wrap gap-2">
                  {(cats.data?.items ?? []).filter((c) => c.type === t).map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-border py-1 pl-3 pr-1 text-sm">
                      <span className="size-2 rounded-full" style={{ background: c.color }} aria-hidden />
                      {c.name}
                      <button className="rounded-full p-1 text-muted hover:bg-red-50 hover:text-expense" aria-label={`ลบหมวด ${c.name}`} onClick={() => setDelCat(c)}>
                        <X className="size-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <ImportOfficeLedger />

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>จัดการข้อมูลและรูปสลิป</CardTitle>
            <CardDescription>ส่งออกข้อมูลได้ที่หน้า <Link href="/reports" className="text-primary underline">รายงาน</Link> (CSV)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button variant="outline" onClick={() => setWipe("images")}><Trash2 /> ลบรูปสลิปทั้งหมด</Button>
            <Button variant="outline" className="text-expense" onClick={() => setWipe("data")}><Trash2 /> ลบข้อมูลการเงินทั้งหมด</Button>
            <Button variant="destructive" onClick={() => setWipe("account")}><Trash2 /> ลบบัญชีถาวร</Button>
            <form action="/auth/signout" method="post" className="sm:ml-auto">
              <Button variant="secondary" className="w-full"><LogOut /> ออกจากระบบ</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={!!delCat}
        onOpenChange={(o) => !o && setDelCat(null)}
        title={`ลบหมวด “${delCat?.name ?? ""}”?`}
        description="รายการที่อยู่ในหมวดนี้จะไม่ถูกลบ แต่จะกลายเป็นไม่ระบุหมวดหมู่ และงบของหมวดนี้จะถูกลบ"
        confirmLabel="ลบหมวด"
        destructive
        loading={busy}
        onConfirm={removeCategory}
      />
      <ConfirmDialog
        open={!!wipe}
        onOpenChange={(o) => {
          if (!o) {
            setWipe(null);
            setConfirmText("");
          }
        }}
        title={wipe === "images" ? "ลบรูปสลิปทั้งหมด?" : wipe === "data" ? "ลบข้อมูลการเงินทั้งหมด?" : "ลบบัญชีถาวร?"}
        description={
          wipe === "images"
            ? "รายการรายรับ–รายจ่ายจะยังอยู่ครบ แต่จะดูรูปสลิปย้อนหลังไม่ได้"
            : wipe === "data"
              ? "ลบรายการ งบประมาณ รูปสลิป และประวัติการจัดหมวดทั้งหมด กู้คืนไม่ได้"
              : "ลบข้อมูลทั้งหมดและบัญชีผู้ใช้ของคุณ กู้คืนไม่ได้"
        }
        confirmLabel="ลบ"
        destructive
        loading={busy}
        onConfirm={() => {
          if (wipe !== "images" && confirmText !== "ลบข้อมูล") return toast.error('กรุณาพิมพ์ "ลบข้อมูล"');
          void doWipe();
        }}
      >
        {wipe && wipe !== "images" && (
          <div className="mt-3">
            <Label htmlFor="ct" className="mb-1.5 block text-sm">พิมพ์คำว่า “ลบข้อมูล” เพื่อยืนยัน</Label>
            <Input id="ct" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}
