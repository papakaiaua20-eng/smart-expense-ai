import { ApiError, dbError, json, readJson, withUser } from "@/lib/api";
import { getCategories } from "@/lib/server/data";
import { categoryInput, zodMessage } from "@/lib/validation";

export const dynamic = "force-dynamic";

export const GET = withUser(async ({ supabase }) => json({ items: await getCategories(supabase) }));

export const POST = withUser(async ({ req, supabase, user }) => {
  const parsed = categoryInput.safeParse(await readJson(req));
  if (!parsed.success) throw new ApiError(400, zodMessage(parsed.error));
  const { data, error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, user_id: user.id, is_default: false })
    .select("id,name,type,icon,color,is_default,sort_order")
    .single();
  if (error?.code === "23505") throw new ApiError(409, "มีหมวดหมู่ชื่อนี้อยู่แล้ว");
  dbError(error);
  return json({ item: data }, 201);
});
