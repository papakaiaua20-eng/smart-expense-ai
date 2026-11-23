"use client";
import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Plus, ReceiptText, ScanLine, Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { PageHeader } from "@/components/app/page-header";
import { RangePicker, rangeQuery, type RangeValue } from "@/components/app/range-picker";
import { CategoryDonut, ExpenseTrend, IncomeExpenseBars } from "@/components/app/charts";
import { TxSummaryRow, type TxLike } from "@/components/app/tx-row";
import { TransactionDialog } from "@/components/app/tx-dialog";
import { useApi } from "@/lib/fetcher";
import { formatNumber, formatTHB, formatThaiDate } from "@/lib/utils";
import type { Summary, BudgetStatus } from "@/lib/summary";
import type { Category } from "@/lib/types";

type DashboardData = Summary & { budgets: BudgetStatus[]; budgetAlerts: BudgetStatus[]; recent: TxLike[] };

const LEVEL_TEXT: Record<string, string> = {
  warning: "ใช้งบเกินเกณฑ์แจ้งเตือนแล้ว",
  reached: "ใช้งบครบ 100% แล้ว",
  exceeded: "ใช้งบเกินกำหนดแล้ว",
};

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted">{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      </div>
      <p className="mt-2 truncate text-xl font-semibold tabular sm:text-2xl" title={value}>
        {value}
      </p>
    </Card>
  );
}

export function DashboardView() {
  const [range, setRange] = useState<RangeValue>({ preset: "this_month", from: "", to: "" });
  const { data, error, loading, reload } = useApi<DashboardData>(`/api/dashboard/summary?${rangeQuery(range)}`);
  const cats = useApi<{ items: Category[] }>("/api/categories");
  const [adding, setAdding] = useState(false);

  return (
    <>
      <PageHeader
        title="ภาพรวมการเงิน"
        description={data ? `${formatThaiDate(data.from)} – ${formatThaiDate(data.to)}` : undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus /> เพิ่มรายการ
            </Button>
            <Button asChild>
              <Link href="/scan">
                <ScanLine /> สแกนสลิป
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-4">
        <RangePicker value={range} onChange={setRange} />
      </div>

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : loading && !data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
          <Skeleton className="h-72 sm:col-span-2 lg:col-span-4" />
        </div>
      ) : data ? (
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data.budgetAlerts.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4" role="status">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                <AlertTriangle className="size-4" /> แจ้งเตือนงบประมาณ
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {data.budgetAlerts.map((b) => (
                  <li key={b.id}>
                    {b.categoryName}: {LEVEL_TEXT[b.level]} ({b.percent}% · ใช้ไป {formatTHB(b.spent)} จาก {formatTHB(b.amount)})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="รายรับรวม" value={formatTHB(data.income)} tone="bg-green-50 text-income" icon={<ArrowDownRight className="size-4" />} />
            <Stat label="รายจ่ายรวม" value={formatTHB(data.expense)} tone="bg-red-50 text-expense" icon={<ArrowUpRight className="size-4" />} />
            <Stat
              label="คงเหลือสุทธิ"
              value={formatTHB(data.net)}
              tone={data.net >= 0 ? "bg-blue-50 text-primary" : "bg-red-50 text-expense"}
              icon={<Scale className="size-4" />}
            />
            <Stat label="จำนวนรายการ" value={formatNumber(data.count)} tone="bg-slate-100 text-muted" icon={<ReceiptText className="size-4" />} />
          </div>
          <p className="-mt-2 text-xs text-muted">
            * คงเหลือสุทธิ = รายรับ − รายจ่าย ของช่วงเวลาที่เลือก ไม่ใช่ยอดเงินคงเหลือจริงในบัญชีธนาคาร
            {data.transferTotal > 0 && ` · โอนระหว่างบัญชี ${formatTHB(data.transferTotal)} ไม่นับรวม`}
          </p>

          {data.count === 0 ? (
            <Card>
              <EmptyState
                title="ยังไม่มีรายการในช่วงเวลานี้"
                description="เริ่มจากสแกนสลิปหรือเพิ่มรายการเอง ระบบจะสรุปให้อัตโนมัติ"
                action={
                  <Button asChild>
                    <Link href="/scan">
                      <ScanLine /> สแกนสลิปแรก
                    </Link>
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>รายรับและรายจ่าย</CardTitle>
                  <CardDescription>
                    แยกราย{data.granularity === "day" ? "วัน" : data.granularity === "week" ? "สัปดาห์" : data.granularity === "month" ? "เดือน" : "ปี"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <IncomeExpenseBars data={data.series} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>สัดส่วนรายจ่ายตามหมวดหมู่</CardTitle>
                  {data.topExpenseCategory && (
                    <CardDescription>
                      ใช้มากที่สุด: {data.topExpenseCategory.name} ({formatTHB(data.topExpenseCategory.amount)})
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {data.expenseByCategory.length ? (
                    <CategoryDonut data={data.expenseByCategory} />
                  ) : (
                    <p className="py-10 text-center text-sm text-muted">ยังไม่มีรายจ่ายในช่วงนี้</p>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>แนวโน้มรายจ่าย</CardTitle>
                </CardHeader>
                <CardContent>
                  <ExpenseTrend data={data.series} />
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>งบประมาณเดือนนี้</CardTitle>
                  <Link href="/budget" className="text-sm text-primary hover:underline">
                    จัดการ
                  </Link>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.budgets.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">
                      ยังไม่ได้ตั้งงบ <Link href="/budget" className="text-primary hover:underline">ตั้งงบเลย</Link>
                    </p>
                  ) : (
                    data.budgets.slice(0, 5).map((b) => (
                      <div key={b.id}>
                        <div className="mb-1 flex justify-between gap-2 text-sm">
                          <span className="truncate">{b.categoryName}</span>
                          <span className="shrink-0 tabular text-muted">{b.percent}%</span>
                        </div>
                        <Progress value={b.percent} color={b.level === "ok" ? b.color : b.level === "warning" ? "#D97706" : "#DC2626"} />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>รายการล่าสุด</CardTitle>
              <Link href="/transactions" className="text-sm text-primary hover:underline">
                ดูทั้งหมด
              </Link>
            </CardHeader>
            <CardContent>
              {data.recent.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">ยังไม่มีรายการ</p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recent.map((t) => (
                    <li key={t.id} className="py-3">
                      <TxSummaryRow t={t} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <TransactionDialog open={adding} onOpenChange={setAdding} categories={cats.data?.items ?? []} onSaved={() => reload()} />
    </>
  );
}
