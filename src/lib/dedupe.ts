// Duplicate detection.
// - "exact": same reference number and amount (also blocked by a DB unique index), or the same
//   image file uploaded before.
// - "possible": same amount and date, and the time or the counterparty also matches.
//   The user is warned and can still save.

export type DupCandidate = {
  amount: number;
  transaction_date: string;
  transaction_time?: string | null;
  reference_number?: string | null;
  merchant_name?: string | null;
};

export type DupRow = {
  id: string;
  amount: string | number;
  transaction_date: string;
  transaction_time: string | null;
  reference_number: string | null;
  merchant_name: string | null;
  type: string;
};

export type DupResult = { level: "none" | "possible" | "exact"; matches: DupRow[]; reason: string | null };

const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9฀-๿]/g, "");

export function classifyDuplicates(c: DupCandidate, rows: DupRow[], excludeId?: string): DupResult {
  const others = rows.filter((r) => r.id !== excludeId);
  const sameAmount = (r: DupRow) => Math.round(Number(r.amount) * 100) === Math.round(c.amount * 100);

  if (c.reference_number) {
    const exact = others.filter((r) => r.reference_number === c.reference_number && sameAmount(r));
    if (exact.length) return { level: "exact", matches: exact, reason: "มีรายการที่เลขอ้างอิงและยอดเงินเดียวกันอยู่แล้ว" };
  }

  const possible = others.filter((r) => {
    if (!sameAmount(r) || r.transaction_date !== c.transaction_date) return false;
    // two slips with different reference numbers are different transactions
    if (c.reference_number && r.reference_number && c.reference_number !== r.reference_number) return false;
    const sameTime = !!c.transaction_time && !!r.transaction_time && c.transaction_time.slice(0, 5) === r.transaction_time.slice(0, 5);
    const sameParty = !!norm(c.merchant_name) && norm(c.merchant_name) === norm(r.merchant_name);
    const noDetail = !c.transaction_time && !c.merchant_name;
    return sameTime || sameParty || noDetail;
  });
  if (possible.length)
    return { level: "possible", matches: possible, reason: "มีรายการยอดเงินและวันที่เดียวกัน อาจเป็นรายการซ้ำ" };
  return { level: "none", matches: [], reason: null };
}
