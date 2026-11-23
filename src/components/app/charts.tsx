"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTHB } from "@/lib/utils";

const compact = (n: number) =>
  new Intl.NumberFormat("th-TH", { notation: "compact", maximumFractionDigits: 1 }).format(n);

const TOOLTIP = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)" };

type Slice = { name: string; amount: number; color: string; percent: number };

export function CategoryDonut({ data }: { data: Slice[] }) {
  const total = data.reduce((a, b) => a + b.amount, 0);
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="amount" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={1} stroke="none">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => formatTHB(Number(v))} contentStyle={TOOLTIP} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted">รายจ่ายรวม</span>
          <span className="text-sm font-semibold tabular">{formatTHB(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-2 text-sm">
        {data.slice(0, 6).map((d) => (
          <li key={d.name} className="flex min-w-0 items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: d.color }} aria-hidden />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="shrink-0 text-muted tabular">{d.percent}%</span>
            <span className="shrink-0 text-right font-medium tabular">{formatTHB(d.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Point = { label: string; income: number; expense: number };

export function IncomeExpenseBars({ data }: { data: Point[] }) {
  return (
    <div className="h-64 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v) => formatTHB(Number(v))} contentStyle={TOOLTIP} cursor={{ fill: "var(--color-slate-100)" }} />
          <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="income" name="รายรับ" fill="#16A34A" radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Bar dataKey="expense" name="รายจ่าย" fill="#DC2626" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpenseTrend({ data }: { data: Point[] }) {
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} tickLine={false} axisLine={false} minTickGap={8} />
          <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} tickFormatter={compact} tickLine={false} axisLine={false} width={48} />
          <Tooltip formatter={(v) => formatTHB(Number(v))} contentStyle={TOOLTIP} />
          <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="#DC2626" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
