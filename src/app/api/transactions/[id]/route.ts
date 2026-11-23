import { z } from "zod";
import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { classifyDuplicates } from "@/lib/dedupe";
import { getDupCandidates, learnMerchantRule } from "@/lib/server/data";
import { transactionPatch, zodMessage } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "ไม่พบรายการ");
  return id;
}

// PATCH /api/transactions/:id
export const PATCH = withUser<Ctx>(async ({ req, supabase, user, ctx }) => {
  const id = await idFrom(ctx);
  const parsed = transactionPatch.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const patch = parsed.data;

  const { data: current, error: e1 } = await supabase.from("transactions").select("*").eq("id", id).maybeSingle();
  dbError(e1);
  if (!current) throw new ApiError(404, "ไม่พบรายการ");

  const next = { ...current, ...patch };
  if (next.type === "transfer") patch.category_id = next.category_id = null;
  if (next.type !== "transfer" && !next.category_id) throw new ApiError(400, "กรุณาเลือกหมวดหมู่");
  if (next.category_id) {
    const { data: cat } = await supabase.from("categories").select("type").eq("id", next.category_id).maybeSingle();
    if (!cat) throw new ApiError(400, "ไม่พบหมวดหมู่ที่เลือก");
    if (cat.type !== next.type) throw new ApiError(400, "หมวดหมู่ไม่ตรงกับประเภทรายการ");
  }

  const cand = { ...next, amount: Number(next.amount) };
  const dup = classifyDuplicates(cand, await getDupCandidates(supabase, cand), id);
  if (dup.level === "exact") throw new ApiError(409, dup.reason!, { code: "duplicate", level: "exact", matches: dup.matches });

  const { data, error } = await supabase
    .from("transactions")
    .update(patch)
    .eq("id", id)
    .select("*, category:categories(id,name,color,icon,type)")
    .single();
  dbError(error);
  if (next.type !== "transfer" && (patch.category_id || patch.merchant_name)) {
    await learnMerchantRule(supabase, user.id, next.merchant_name, next.category_id);
  }
  return json({ item: data });
});

// DELETE /api/transactions/:id
export const DELETE = withUser<Ctx>(async ({ supabase, ctx }) => {
  const id = await idFrom(ctx);
  const { data, error } = await supabase.from("transactions").delete().eq("id", id).select("id,receipt_id");
  dbError(error);
  if (!data?.length) throw new ApiError(404, "ไม่พบรายการ");
  // remove the slip image too if no other transaction uses it
  const receiptId = data[0].receipt_id as string | null;
  if (receiptId) {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("receipt_id", receiptId);
    if (!count) {
      const { data: rec } = await supabase.from("receipts").select("storage_path").eq("id", receiptId).maybeSingle();
      if (rec?.storage_path) await supabase.storage.from("receipts").remove([rec.storage_path]);
      await supabase.from("receipts").delete().eq("id", receiptId);
    }
  }
  return json({ ok: true });
});
