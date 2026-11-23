import { ScanLine } from "lucide-react";
import { formatTHB, formatThaiDate } from "@/lib/utils";
import { TX_TYPE_LABEL, type TxType } from "@/lib/types";

export type TxLike = {
  id: string;
  type: TxType;
  amount: string | number;
  merchant_name: string | null;
  transaction_date: string;
  transaction_time?: string | null;
  source?: string;
  category?: { name: string; color: string } | null;
};

export function Amount({ type, amount }: { type: TxType; amount: string | number }) {
  const sign = type === "income" ? "+" : type === "expense" ? "−" : "";
  const cls = type === "income" ? "text-income" : type === "expense" ? "text-expense" : "text-muted";
  return (
    <span className={`font-semibold tabular whitespace-nowrap ${cls}`}>
      {sign}
      {formatTHB(amount)}
    </span>
  );
}

export function TxSummaryRow({ t }: { t: TxLike }) {
  const color = t.type === "transfer" ? "#94A3B8" : (t.category?.color ?? "#94A3B8");
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold text-white" style={{ background: color }} aria-hidden>
        {(t.type === "transfer" ? "โ" : t.category?.name ?? "?").slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{t.merchant_name || (t.type === "transfer" ? TX_TYPE_LABEL.transfer : t.category?.name) || "-"}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted">
          {formatThaiDate(t.transaction_date)}
          {t.transaction_time ? ` · ${t.transaction_time.slice(0, 5)}` : ""}
          {t.type !== "transfer" && t.category ? ` · ${t.category.name}` : t.type === "transfer" ? " · โอนระหว่างบัญชี" : " · ไม่ระบุหมวดหมู่"}
          {t.source === "ocr" && <ScanLine className="size-3 shrink-0" aria-label="จากสลิป" />}
        </p>
      </div>
      <Amount type={t.type} amount={t.amount} />
    </div>
  );
}
