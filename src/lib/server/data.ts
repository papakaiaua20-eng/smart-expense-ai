import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { dbError } from "../api";
import { normalizeMerchant } from "../categorize";
import type { Category, MerchantRule } from "../types";
import type { TxRow } from "../summary";
import type { DupRow } from "../dedupe";

export async function getCategories(supabase: SupabaseClient): Promise<Category[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name,type,icon,color,is_default,sort_order")
    .order("type")
    .order("sort_order")
    .order("name");
  dbError(error);
  return (data ?? []) as Category[];
}

export async function getRules(supabase: SupabaseClient): Promise<MerchantRule[]> {
  const { data, error } = await supabase.from("merchant_rules").select("merchant_pattern,category_id,hit_count");
  dbError(error);
  return (data ?? []) as MerchantRule[];
}

/** Remember "this merchant -> this category" so the next suggestion uses it. */
export async function learnMerchantRule(
  supabase: SupabaseClient,
  userId: string,
  merchant: string | null | undefined,
  categoryId: string | null | undefined,
) {
  const pattern = normalizeMerchant(merchant ?? "");
  if (!pattern || !categoryId) return;
  const { data: existing } = await supabase
    .from("merchant_rules")
    .select("id,category_id,hit_count")
    .eq("merchant_pattern", pattern)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("merchant_rules")
      .update({
        category_id: categoryId,
        hit_count: existing.category_id === categoryId ? existing.hit_count + 1 : 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("merchant_rules").insert({ user_id: userId, merchant_pattern: pattern, category_id: categoryId });
  }
}

/** Fetch all rows for aggregation, paging past PostgREST's 1000-row cap. */
export async function getTxRows(supabase: SupabaseClient, from: string, to: string): Promise<TxRow[]> {
  const out: TxRow[] = [];
  const page = 1000;
  for (let offset = 0; offset < 200_000; offset += page) {
    const { data, error } = await supabase
      .from("transactions")
      .select("type,amount,transaction_date,category_id")
      .gte("transaction_date", from)
      .lte("transaction_date", to)
      .order("transaction_date")
      .order("id")
      .range(offset, offset + page - 1);
    dbError(error);
    out.push(...((data ?? []) as TxRow[]));
    if (!data || data.length < page) break;
  }
  return out;
}

export async function getDupCandidates(
  supabase: SupabaseClient,
  c: { amount: number; transaction_date: string; reference_number?: string | null },
): Promise<DupRow[]> {
  const cols = "id,amount,transaction_date,transaction_time,reference_number,merchant_name,type";
  const queries = [
    supabase.from("transactions").select(cols).eq("amount", c.amount).eq("transaction_date", c.transaction_date).limit(20),
  ];
  if (c.reference_number) {
    queries.push(supabase.from("transactions").select(cols).eq("reference_number", c.reference_number).limit(20));
  }
  const results = await Promise.all(queries);
  const map = new Map<string, DupRow>();
  for (const r of results) {
    dbError(r.error);
    for (const row of (r.data ?? []) as DupRow[]) map.set(row.id, row);
  }
  return [...map.values()];
}
