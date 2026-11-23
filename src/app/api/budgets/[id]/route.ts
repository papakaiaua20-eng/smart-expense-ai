import { z } from "zod";
import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { budgetPatch, zodMessage } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

async function idFrom(ctx: Ctx) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) throw new ApiError(404, "ไม่พบงบประมาณ");
  return id;
}

export const PATCH = withUser<Ctx>(async ({ req, supabase, ctx }) => {
  const id = await idFrom(ctx);
  const parsed = budgetPatch.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const { data, error } = await supabase.from("budgets").update(parsed.data).eq("id", id).select().maybeSingle();
  dbError(error);
  if (!data) throw new ApiError(404, "ไม่พบงบประมาณ");
  return json({ item: data });
});

export const DELETE = withUser<Ctx>(async ({ supabase, ctx }) => {
  const id = await idFrom(ctx);
  const { data, error } = await supabase.from("budgets").delete().eq("id", id).select("id");
  dbError(error);
  if (!data?.length) throw new ApiError(404, "ไม่พบงบประมาณ");
  return json({ ok: true });
});
