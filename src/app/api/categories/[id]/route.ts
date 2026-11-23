import { z } from "zod";
import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { categoryInput, zodMessage } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };
const patchSchema = categoryInput.pick({ name: true, color: true, icon: true }).partial();

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "ไม่พบหมวดหมู่");
  return id;
}

export const PATCH = withUser<Ctx>(async ({ req, supabase, ctx }) => {
  const id = await idFrom(ctx);
  const parsed = patchSchema.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const { data, error } = await supabase.from("categories").update(parsed.data).eq("id", id).select().maybeSingle();
  if (error?.code === "23505") throw new ApiError(409, "มีหมวดหมู่ชื่อนี้อยู่แล้ว");
  dbError(error);
  if (!data) throw new ApiError(404, "ไม่พบหมวดหมู่");
  return json({ item: data });
});

// Transactions in a deleted category keep existing with no category (shown as "ไม่ระบุหมวดหมู่").
export const DELETE = withUser<Ctx>(async ({ supabase, ctx }) => {
  const id = await idFrom(ctx);
  const { data, error } = await supabase.from("categories").delete().eq("id", id).select("id");
  dbError(error);
  if (!data?.length) throw new ApiError(404, "ไม่พบหมวดหมู่");
  return json({ ok: true });
});
