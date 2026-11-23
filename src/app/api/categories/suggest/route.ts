import { z } from "zod";
import { ApiError, json, readJson, withUser } from "@/lib/api";
import { suggestCategory } from "@/lib/categorize";
import { getCategories, getRules } from "@/lib/server/data";

const schema = z.object({ merchant: z.string().max(120), type: z.enum(["income", "expense"]) });

export const POST = withUser(async ({ req, supabase }) => {
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, "ข้อมูลไม่ถูกต้อง");
  const [categories, rules] = await Promise.all([getCategories(supabase), getRules(supabase)]);
  return json(suggestCategory({ ...parsed.data, categories, rules }));
});
