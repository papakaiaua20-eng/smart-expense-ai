import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { classifyDuplicates } from "@/lib/dedupe";
import { getDupCandidates, learnMerchantRule } from "@/lib/server/data";
import { transactionInput, transactionQuery, zodMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

const SELECT =
  "id,type,amount,currency,category_id,merchant_name,transaction_date,transaction_time,payment_method,bank,sender_name,receiver_name,reference_number,source,receipt_id,note,created_at,updated_at,category:categories(id,name,color,icon,type)";

// GET /api/transactions?from&to&type&category_id&q&sort&page&page_size
export const GET = withUser(async ({ req, supabase }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = transactionQuery.safeParse(params);
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const q = parsed.data;

  let query = supabase.from("transactions").select(SELECT, { count: "exact" });
  if (q.from) query = query.gte("transaction_date", q.from);
  if (q.to) query = query.lte("transaction_date", q.to);
  if (q.type) query = query.eq("type", q.type);
  if (q.category_id) query = query.eq("category_id", q.category_id);
  if (q.q) {
    const term = q.q.replace(/[%_,()*\\]/g, " ").trim();
    if (term) {
      query = query.or(
        ["merchant_name", "note", "reference_number", "sender_name", "receiver_name"]
          .map((c) => `${c}.ilike.*${term}*`)
          .join(","),
      );
    }
  }
  const [col, dir] = {
    date_desc: ["transaction_date", false],
    date_asc: ["transaction_date", true],
    amount_desc: ["amount", false],
    amount_asc: ["amount", true],
  }[q.sort] as [string, boolean];
  query = query.order(col, { ascending: dir }).order("created_at", { ascending: dir });

  const start = (q.page - 1) * q.page_size;
  const { data, error, count } = await query.range(start, start + q.page_size - 1);
  dbError(error);
  return json({ items: data ?? [], total: count ?? 0, page: q.page, page_size: q.page_size });
});

// POST /api/transactions
export const POST = withUser(async ({ req, supabase, user }) => {
  const parsed = transactionInput.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const { confirm_duplicate, ...input } = parsed.data;
  if (input.type === "transfer") input.category_id = null;

  // category must exist, belong to the user (RLS), and match the type
  if (input.category_id) {
    const { data: cat } = await supabase.from("categories").select("type").eq("id", input.category_id).maybeSingle();
    if (!cat) throw new ApiError(400, "ไม่พบหมวดหมู่ที่เลือก");
    if (cat.type !== input.type) throw new ApiError(400, "หมวดหมู่ไม่ตรงกับประเภทรายการ");
  }

  // receipt must belong to the user
  if (input.receipt_id) {
    const { data: r } = await supabase.from("receipts").select("id").eq("id", input.receipt_id).maybeSingle();
    if (!r) throw new ApiError(400, "ไม่พบรูปสลิป");
  }

  const dup = classifyDuplicates(input, await getDupCandidates(supabase, input));
  if (dup.level === "exact") {
    throw new ApiError(409, dup.reason!, { code: "duplicate", level: "exact", matches: dup.matches });
  }
  if (dup.level === "possible" && !confirm_duplicate) {
    throw new ApiError(409, dup.reason!, { code: "duplicate", level: "possible", matches: dup.matches });
  }

  const { data, error } = await supabase
    .from("transactions")
    .insert({ ...input, user_id: user.id, currency: "THB" })
    .select(SELECT)
    .single();
  if (error?.code === "23505") {
    throw new ApiError(409, "มีรายการที่เลขอ้างอิงและยอดเงินเดียวกันอยู่แล้ว", { code: "duplicate", level: "exact" });
  }
  dbError(error);

  if (input.type !== "transfer") await learnMerchantRule(supabase, user.id, input.merchant_name, input.category_id);

  // optional: drop the slip image once saved, if the user chose not to keep images
  if (input.receipt_id) {
    const { data: profile } = await supabase.from("profiles").select("keep_receipt_images").eq("id", user.id).single();
    if (profile && !profile.keep_receipt_images) {
      const { data: rec } = await supabase.from("receipts").select("storage_path").eq("id", input.receipt_id).single();
      if (rec?.storage_path) {
        await supabase.storage.from("receipts").remove([rec.storage_path]);
        await supabase.from("receipts").update({ storage_path: null }).eq("id", input.receipt_id);
      }
    }
  }
  return json({ item: data }, 201);
});
