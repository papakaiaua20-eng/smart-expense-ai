"use client";
import { useMemo, useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { PageHeader } from "@/components/app/page-header";
import { IncomeExpenseBars } from "@/components/app/charts";
import { useApi } from "@/lib/fetcher";
import { addDays, addMonths, endOfMonth, startOfMonth, startOfWeek, todayISO, type Granularity } from "@/lib/dates";
import { formatTHB, formatThaiDate } from "@/lib/utils";
import type { CategoryComparison, Summary } from "@/lib/summary";

type ReportResp = {
  current: Summary;
  previous: { from: string; to: string; income: number; expense: number; net: number; count: number };
  change: { income: number | null; expense: number | null };
  categories: CategoryComparison[];
};

const PERIODS: { id: string; label: string; g: Granularity; range: () => [string, string] }[] = [
  { id: "daily", label: "สรุปรายวัน (7 วัน)", g: "day", range: () => [addDays(todayISO(), -6), todayISO()] },
  { id: "weekly", label: "สรุปรายสัปดาห์ (8 สัปดาห์)", g: "week", range: () => [startOfWeek(addDays(todayISO(), -49)), addDays(startOfWeek(todayISO()), 6)] },
  { id: "monthly", label: "สรุปรายเดือน (เดือนนี้)", g: "day", range: () => [startOfMonth(todayISO()), endOfMonth(todayISO())] },
  { id: "months12", label: "รายเดือน 12 เดือนล่าสุด", g: "month", range: () => [addMonths(todayISO(), -11), endOfMonth(todayISO())] },
  { id: "yearly", label: "สรุปรายปี (ปีนี้)", g: "month", range: () => [`${todayISO().slice(0, 4)}-01-01`, `${todayISO().slice(0, 4)}-12-31`] },
  { id: "custom", label: "กำหนดเอง", g: "day", range: () => [startOfMonth(todayISO()), todayISO()] },
];

function Change({ v, invert }: { v: number | null; invert?: boolean }) {
  if (v === null) return <span className="text-xs text-muted">ไม่มีข้อมูลช่วงก่อน</span>;
  const up = v > 0;
  const good = invert ? !up : up;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${v === 0 ? "text-muted" : good ? "text-income" : "text-expense"}`}>
      {up ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
      {up ? "+" : ""}
      {v}% จากช่วงก่อน
    </span>
  );
}

export function ReportsView() {
  const [period, setPeriod] = useState("monthly");
  const [custom, setCustom] = useState({ from: startOfMonth(todayISO()), to: todayISO(), g: "day" as Granularity });
  const p = PERIODS.find((x) => x.id === period)!;
  const [from, to] = period === "custom" ? [custom.from, custom.to] : p.range();
  const g = period === "custom" ? custom.g : p.g;
  const valid = !!from && !!to && from <= to;
  const url = useMemo(() => (valid ? `/api/reports?from=${from}&to=${to}&granularity=${g}` : null), [from, to, g, valid]);
  const { data, error, loading, reload } = useApi<ReportResp>(url);

  return (
    <>
      <PageHeader
        title="รายงาน"
        description={valid ? `${formatThaiDate(from)} – ${formatThaiDate(to)}` : undefined}
        actions={
          <Button asChild variant="outline" disabled={!valid}>
            <a href={valid ? `/api/reports/export?from=${from}&to=${to}` : "#"} download>
              <Download /> ดาวน์โหลด CSV
            </a>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <NativeSelect aria-label="รูปแบบรายงาน" className="h-10 w-auto" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {PERIODS.map((x) => (
            <option key={x.id} value={x.id}>{x.label}</option>
          ))}
        </NativeSelect>
        {period === "custom" && (
          <>
            <Input type="date" aria-label="ตั้งแต่วันที่" className="h-10 w-[9.5rem]" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} />
            <Input type="date" aria-label="ถึงวันที่" className="h-10 w-[9.5rem]" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} />
            <NativeSelect aria-label="แยกตาม" className="h-10 w-auto" value={custom.g} onChange={(e) => setCustom({ ...custom, g: e.target.value as Granularity })}>
              <option value="day">รายวัน</option>
              <option value="week">รายสัปดาห์</option>
              <option value="month">รายเดือน</option>
              <option value="year">รายปี</option>
            </NativeSelect>
          </>
        )}
      </div>

      {!valid ? (
        <Card><ErrorState message="ช่วงวันที่ไม่ถูกต้อง" /></Card>
      ) : error ? (
        <Card><ErrorState message={error} onRetry={reload} /></Card>
      ) : loading && !data ? (
        <Card><LoadingState /></Card>
      ) : data ? (
        <div className={`flex flex-col gap-4 ${loading ? "opacity-60" : ""}`}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-sm text-muted">รายรับ</p>
              <p className="mt-1 text-xl font-semibold text-income tabular">{formatTHB(data.current.income)}</p>
              <Change v={data.change.income} />
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">รายจ่าย</p>
              <p className="mt-1 text-xl font-semibold text-expense tabular">{formatTHB(data.current.expense)}</p>
              <Change v={data.change.expense} invert />
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted">คงเหลือสุทธิ</p>
              <p className="mt-1 text-xl font-semibold tabular">{formatTHB(data.current.net)}</p>
              <span className="text-xs text-muted">ช่วงก่อน {formatTHB(data.previous.net)}</span>
            </Card>
          </div>
          <p className="-mt-2 text-xs text-muted">
            เปรียบเทียบกับ {formatThaiDate(data.previous.from)} – {formatThaiDate(data.previous.to)} (ช่วงก่อนหน้าที่ยาวเท่ากัน)
          </p>

          {data.current.count === 0 ? (
            <Card><EmptyState title="ไม่มีรายการในช่วงนี้" /></Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>รายรับ–รายจ่าย</CardTitle>
                </CardHeader>
                <CardContent>
                  <IncomeExpenseBars data={data.current.series} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>วิเคราะห์รายจ่ายตามหมวดหมู่</CardTitle>
                  <CardDescription>เทียบกับช่วงก่อนหน้า คำนวณจากรายการที่บันทึกจริงเท่านั้น</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.categories.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted">ไม่มีรายจ่าย</p>
                  ) : (
                    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                      <table className="w-full min-w-[30rem] text-sm">
                        <thead>
                          <tr className="border-b border-border text-left text-xs text-muted">
                            <th className="py-2 font-medium">หมวดหมู่</th>
                            <th className="py-2 text-right font-medium">ช่วงนี้</th>
                            <th className="py-2 text-right font-medium">ช่วงก่อน</th>
                            <th className="py-2 text-right font-medium">เปลี่ยนแปลง</th>
                          </tr>
                        </thead>
                        <tbody className="tabular">
                          {data.categories.map((c) => (
                            <tr key={c.id ?? "none"} className="border-b border-border last:border-0">
                              <td className="py-2">
                                <span className="flex items-center gap-2">
                                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: c.color }} aria-hidden />
                                  {c.name}
                                </span>
                              </td>
                              <td className="py-2 text-right">{formatTHB(c.current)}</td>
                              <td className="py-2 text-right text-muted">{formatTHB(c.previous)}</td>
                              <td className={`py-2 text-right ${c.change > 0 ? "text-expense" : c.change < 0 ? "text-income" : "text-muted"}`}>
                                {c.change > 0 ? "+" : ""}
                                {formatTHB(c.change)}
                                {c.changePercent !== null && <span className="ml-1 text-xs">({c.changePercent > 0 ? "+" : ""}{c.changePercent}%)</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>สรุปตามช่วงเวลา</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                    <table className="w-full min-w-[26rem] text-sm tabular">
                      <thead>
                        <tr className="border-b border-border text-left text-xs text-muted">
                          <th className="py-2 font-medium">ช่วง</th>
                          <th className="py-2 text-right font-medium">รายรับ</th>
                          <th className="py-2 text-right font-medium">รายจ่าย</th>
                          <th className="py-2 text-right font-medium">สุทธิ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.current.series.map((s) => (
                          <tr key={s.key} className="border-b border-border last:border-0">
                            <td className="py-2">{s.label}</td>
                            <td className="py-2 text-right text-income">{formatTHB(s.income)}</td>
                            <td className="py-2 text-right text-expense">{formatTHB(s.expense)}</td>
                            <td className="py-2 text-right">{formatTHB(s.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
