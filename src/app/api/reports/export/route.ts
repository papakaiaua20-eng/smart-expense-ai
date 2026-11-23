import { ApiError, dbError, withUser } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { isValidISODate } from "@/lib/dates";
import { TX_TYPE_LABEL, type TxType } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/reports/export?from&to -> CSV of transactions
export const GET = withUser(async ({ req, supabase }) => {
  const sp = new URL(req.url).searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!isValidISODate(from) || !isValidISODate(to) || from > to) throw new ApiError(400, "ช่วงวันที่ไม่ถูกต้อง");

  type Row = {
    transaction_date: string; transaction_time: string | null; type: TxType; amount: string | number;
    merchant_name: string | null; payment_method: string | null; bank: string | null; reference_number: string | null;
    note: string | null; source: string; category: { name: string } | null;
  };
  const rows: Row[] = [];
  for (let offset = 0; offset < 100_000; offset += 1000) {
    const { data, error } = await supabase
      .from("transactions")
      .select("transaction_date,transaction_time,type,amount,merchant_name,payment_method,bank,reference_number,note,source,category:categories(name)")
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date")
      .order("created_at")
      .range(offset, offset + 999);
    dbError(error);
    rows.push(...((data ?? []) as unknown as Row[]));
    if (!data || data.length < 1000) break;
  }

  const csv = toCsv(
    ["วันที่", "เวลา", "ประเภท", "จำนวนเงิน (บาท)", "หมวดหมู่", "ร้านค้า/ผู้เกี่ยวข้อง", "ช่องทางชำระ", "ธนาคาร", "เลขอ้างอิง", "หมายเหตุ", "ที่มา"],
    rows.map((r) => [
      r.transaction_date,
      r.transaction_time?.slice(0, 5) ?? "",
      TX_TYPE_LABEL[r.type],
      Number(r.amount).toFixed(2),
      r.category?.name ?? "",
      r.merchant_name,
      r.payment_method,
      r.bank,
      r.reference_number,
      r.note,
      r.source === "ocr" ? "สแกนสลิป" : "กรอกเอง",
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="smart-expense-${from}-to-${to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
});
