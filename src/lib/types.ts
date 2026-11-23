export type TxType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
};

export type Transaction = {
  id: string;
  type: TxType;
  amount: string | number; // NUMERIC comes back as string from PostgREST when large; we coerce
  currency: string;
  category_id: string | null;
  merchant_name: string | null;
  transaction_date: string;
  transaction_time: string | null;
  payment_method: string | null;
  bank: string | null;
  sender_name: string | null;
  receiver_name: string | null;
  reference_number: string | null;
  source: "manual" | "ocr" | "import";
  receipt_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  category?: Pick<Category, "id" | "name" | "color" | "icon" | "type"> | null;
};

export type Budget = {
  id: string;
  category_id: string | null;
  amount: string | number;
  period_start: string;
  period_end: string;
  alert_threshold: string | number;
};

export type MerchantRule = { merchant_pattern: string; category_id: string; hit_count: number };

export const TX_TYPE_LABEL: Record<TxType, string> = {
  income: "รายรับ",
  expense: "รายจ่าย",
  transfer: "โอนระหว่างบัญชี",
};

export const PAYMENT_METHODS = [
  "เงินสด",
  "โอนผ่านธนาคาร",
  "พร้อมเพย์",
  "บัตรเครดิต",
  "บัตรเดบิต",
  "e-Wallet",
  "อื่น ๆ",
] as const;
