"use client";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/app/page-header";
import { TransactionDialog } from "@/components/app/tx-dialog";
import { TxSummaryRow } from "@/components/app/tx-row";
import { api, useApi } from "@/lib/fetcher";
import { formatNumber, formatTHB } from "@/lib/utils";
import type { Category, Transaction } from "@/lib/types";

type ListResp = { items: Transaction[]; total: number; page: number; page_size: number };

export function TransactionsView() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("date_desc");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(1), [debouncedQ, from, to, type, category, sort]);

  const url = useMemo(() => {
    const p = new URLSearchParams({ sort, page: String(page), page_size: "20" });
    if (debouncedQ) p.set("q", debouncedQ);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (type) p.set("type", type);
    if (category) p.set("category_id", category);
    return `/api/transactions?${p}`;
  }, [debouncedQ, from, to, type, category, sort, page]);

  const { data, error, loading, reload } = useApi<ListResp>(url);
  const cats = useApi<{ items: Category[] }>("/api/categories");
  const categories = cats.data?.items ?? [];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const filtered = !!(debouncedQ || from || to || type || category);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/transactions/${deleting.id}`, { method: "DELETE" });
      toast.success("ลบรายการแล้ว");
      setDeleting(null);
      void reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="รายการธุรกรรม"
        description={data ? `ทั้งหมด ${formatNumber(data.total)} รายการ` : undefined}
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> เพิ่มรายการ
          </Button>
        }
      />

      <Card className="mb-4 p-3 sm:p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            placeholder="ค้นหาร้านค้า หมายเหตุ หรือเลขอ้างอิง"
            aria-label="ค้นหา"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
          <Input type="date" aria-label="ตั้งแต่วันที่" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10" />
          <Input type="date" aria-label="ถึงวันที่" value={to} onChange={(e) => setTo(e.target.value)} className="h-10" />
          <NativeSelect aria-label="ประเภท" value={type} onChange={(e) => setType(e.target.value)} className="h-10">
            <option value="">ทุกประเภท</option>
            <option value="expense">รายจ่าย</option>
            <option value="income">รายรับ</option>
            <option value="transfer">โอนระหว่างบัญชี</option>
          </NativeSelect>
          <NativeSelect aria-label="หมวดหมู่" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10">
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.type === "income" ? "รับ · " : "จ่าย · "}
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="เรียงลำดับ" value={sort} onChange={(e) => setSort(e.target.value)} className="col-span-2 h-10 md:col-span-1">
            <option value="date_desc">ใหม่ → เก่า</option>
            <option value="date_asc">เก่า → ใหม่</option>
            <option value="amount_desc">ยอดมาก → น้อย</option>
            <option value="amount_asc">ยอดน้อย → มาก</option>
          </NativeSelect>
        </div>
        {filtered && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 px-0"
            onClick={() => {
              setQ("");
              setFrom("");
              setTo("");
              setType("");
              setCategory("");
            }}
          >
            ล้างตัวกรอง
          </Button>
        )}
      </Card>

      <Card>
        {error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingState />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            title={filtered ? "ไม่พบรายการที่ตรงกับตัวกรอง" : "ยังไม่มีรายการ"}
            description={filtered ? "ลองเปลี่ยนคำค้นหรือช่วงวันที่" : "เพิ่มรายการเองหรือสแกนสลิปเพื่อเริ่มต้น"}
          />
        ) : (
          <ul className={`divide-y divide-border ${loading ? "opacity-60" : ""}`}>
            {data.items.map((t) => (
              <li key={t.id} className="flex items-center gap-1 px-3 py-3 sm:px-4">
                <button
                  className="min-w-0 flex-1 rounded-lg text-left hover:bg-slate-50"
                  onClick={() => {
                    setEditing(t);
                    setDialogOpen(true);
                  }}
                  aria-label={`แก้ไข ${t.merchant_name ?? ""} ${formatTHB(t.amount)}`}
                >
                  <TxSummaryRow t={t} />
                  {t.note && <p className="mt-0.5 truncate pl-[3.25rem] text-xs text-muted">{t.note}</p>}
                </button>
                <div className="flex shrink-0">
                  {t.receipt_id && (
                    <Button asChild variant="ghost" size="icon" aria-label="ดูรูปสลิป">
                      <a href={`/api/receipts/${t.receipt_id}/image`} target="_blank" rel="noopener noreferrer">
                        <ImageIcon />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="hidden sm:inline-flex"
                    aria-label="แก้ไข"
                    onClick={() => {
                      setEditing(t);
                      setDialogOpen(true);
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button variant="ghost" size="icon" aria-label="ลบ" onClick={() => setDeleting(t)} className="text-expense">
                    <Trash2 />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {data && pages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft /> ก่อนหน้า
            </Button>
            <span className="text-muted">
              หน้า {page} / {pages}
            </span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              ถัดไป <ChevronRight />
            </Button>
          </div>
        )}
      </Card>

      <TransactionDialog open={dialogOpen} onOpenChange={setDialogOpen} categories={categories} editing={editing} onSaved={() => reload()} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="ลบรายการนี้?"
        description={
          deleting ? (
            <>
              {deleting.merchant_name ?? "รายการ"} · {formatTHB(deleting.amount)}
              <br />
              ลบแล้วกู้คืนไม่ได้{deleting.receipt_id ? " และรูปสลิปที่แนบไว้จะถูกลบด้วย" : ""}
            </>
          ) : null
        }
        confirmLabel="ลบรายการ"
        destructive
        loading={busy}
        onConfirm={confirmDelete}
      />
    </>
  );
}
