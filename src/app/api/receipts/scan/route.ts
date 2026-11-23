import { createHash, randomUUID } from "node:crypto";
import { ApiError, dbError, json, withUser } from "@/lib/api";
import { suggestCategory } from "@/lib/categorize";
import { classifyDuplicates } from "@/lib/dedupe";
import { todayISO } from "@/lib/dates";
import { getOcrProvider } from "@/lib/ocr";
import { getCategories, getDupCandidates, getRules } from "@/lib/server/data";
import { parseSlip } from "@/lib/slip/parser";
import { maskAccount } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const RATE_LIMIT = Number(process.env.OCR_RATE_LIMIT_PER_HOUR ?? 30);

function sniffMime(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP")
    return "image/webp";
  return null;
}

// POST /api/receipts/scan  (multipart/form-data: file, qr?)
export const POST = withUser(async ({ req, supabase, user }) => {
  // 1) rate limit OCR per user
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: recent } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if ((recent ?? 0) >= RATE_LIMIT) {
    throw new ApiError(429, `สแกนได้ไม่เกิน ${RATE_LIMIT} รูปต่อชั่วโมง กรุณารอสักครู่`);
  }

  // 2) validate file type (by content, not by name) and size
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new ApiError(400, "กรุณาแนบรูปสลิป");
  }
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "กรุณาแนบรูปสลิป");
  if (file.size === 0) throw new ApiError(400, "ไฟล์ว่างเปล่า");
  if (file.size > MAX_BYTES) throw new ApiError(413, "ไฟล์ใหญ่เกิน 5 MB");
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(buf);
  if (!mime) throw new ApiError(415, "รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP");
  const qrPayload = typeof form.get("qr") === "string" ? String(form.get("qr")).slice(0, 300) : null;

  // 3) OCR provider + consent if the image leaves our server
  const provider = getOcrProvider();
  const { data: profile } = await supabase
    .from("profiles")
    .select("account_names,ocr_consent_at")
    .eq("id", user.id)
    .single();
  if (provider?.external && !profile?.ocr_consent_at) {
    throw new ApiError(403, "กรุณายอมรับการส่งรูปไปอ่านข้อความก่อน", { code: "consent_required", provider: provider.label });
  }

  // 4) same image uploaded before?
  const fileHash = createHash("sha256").update(buf).digest("hex");
  const { data: sameFile } = await supabase.from("receipts").select("id").eq("file_hash", fileHash).limit(5);
  let sameFileTx: { id: string }[] = [];
  if (sameFile?.length) {
    const { data } = await supabase
      .from("transactions")
      .select("id,amount,transaction_date,transaction_time,reference_number,merchant_name,type")
      .in("receipt_id", sameFile.map((r) => r.id));
    sameFileTx = data ?? [];
  }

  // 5) store the image privately: <user_id>/<uuid>.<ext>
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const storagePath = `${user.id}/${randomUUID()}.${ext}`;
  const up = await supabase.storage.from("receipts").upload(storagePath, buf, { contentType: mime, upsert: false });
  if (up.error) {
    console.error("[scan] upload", up.error);
    throw new ApiError(500, `อัปโหลดรูปไม่สำเร็จ: ${up.error.message}`.slice(0, 200));
  }

  const { data: receipt, error: recErr } = await supabase
    .from("receipts")
    .insert({
      user_id: user.id,
      storage_path: storagePath,
      mime_type: mime,
      file_size: buf.length,
      file_hash: fileHash,
      ocr_status: provider ? "pending" : "not_configured",
      ocr_provider: provider?.id ?? null,
    })
    .select("id")
    .single();
  dbError(recErr);

  if (!provider) {
    return json({
      receipt_id: receipt!.id,
      status: "not_configured",
      message: "ยังไม่ได้ตั้งค่าบริการ OCR กรุณากรอกข้อมูลจากสลิปเอง",
      parsed: null,
      duplicate: sameFileTx.length ? { level: "exact", reason: "เคยอัปโหลดรูปนี้แล้ว", matches: sameFileTx } : null,
    });
  }

  // 6) OCR
  let text = "";
  let ocrConfidence: number | null = null;
  try {
    const r = await provider.recognize(buf, mime);
    text = r.text;
    ocrConfidence = r.confidence;
  } catch (e) {
    console.error("[scan] ocr", e);
    await supabase
      .from("receipts")
      .update({ ocr_status: "failed", error_message: String((e as Error).message).slice(0, 300) })
      .eq("id", receipt!.id);
    return json({
      receipt_id: receipt!.id,
      status: "failed",
      message: "อ่านข้อความจากสลิปไม่สำเร็จ กรุณากรอกข้อมูลเอง",
      parsed: null,
      duplicate: null,
    });
  }

  // 7) parse + validate
  const parsed = parseSlip(text, {
    qrPayload,
    ownAccountNames: profile?.account_names ?? [],
    today: todayISO(),
  });
  const readable = parsed.amount.value !== null || parsed.date.value !== null || parsed.reference.value !== null;

  // 8) duplicates
  let duplicate = null as null | { level: string; reason: string | null; matches: unknown[] };
  if (sameFileTx.length) {
    duplicate = { level: "exact", reason: "เคยอัปโหลดและบันทึกรูปสลิปนี้แล้ว", matches: sameFileTx };
  } else if (parsed.amount.value !== null && parsed.date.value) {
    const cand = {
      amount: parsed.amount.value,
      transaction_date: parsed.date.value,
      transaction_time: parsed.time.value,
      reference_number: parsed.reference.value,
    };
    const d = classifyDuplicates(cand, await getDupCandidates(supabase, cand));
    if (d.level !== "none") duplicate = d;
  }

  // 9) category suggestion (counterparty = receiver for expense, sender for income)
  const [categories, rules] = await Promise.all([getCategories(supabase), getRules(supabase)]);
  const t = parsed.suggestedType.value;
  const catType = t === "income" ? "income" : "expense";
  const counterparty = t === "income" ? parsed.senderName.value : parsed.receiverName.value;
  let category =
    t === "transfer" ? null : suggestCategory({ merchant: counterparty, type: catType, categories, rules });
  // Payee unknown (e.g. "123 เซอร์วิส" bill counter): try the slip memo, then the customer-name line
  if (category && category.confidence <= 0.2) {
    const lines = text.replace(/ํา/g, "ำ").split("\n").map((l) => l.replace(/\s+/g, " "));
    const grab = (re: RegExp) => lines.map((l) => re.exec(l)?.[1]?.trim()).find(Boolean);
    const candidates = [
      grab(/(?:บันทึกช่วยจำ|บันทึก|memo|note)\s*[:：]?\s*(.+)/i),
      grab(/(?:รหัสลูกค้า|ชื่อลูกค้า)\s*[:：]?\s*(.+)/i),
    ];
    for (const extra of candidates) {
      if (!extra) continue;
      const alt = suggestCategory({ merchant: extra, type: catType, categories, rules });
      if (alt.confidence > category.confidence) {
        category = { ...alt, confidence: 0.5, reason: `เดาจากข้อความบนสลิป "${extra.slice(0, 40)}"` };
        break;
      }
    }
  }

  const status = !readable ? "failed" : parsed.needsReview ? "needs_review" : "success";
  const maskedText = maskAccount(text) ?? "";
  await supabase
    .from("receipts")
    .update({
      ocr_status: status,
      raw_text: maskedText.slice(0, 5000),
      extracted_data: parsed,
      confidence_score: parsed.overallConfidence,
    })
    .eq("id", receipt!.id);

  return json({
    receipt_id: receipt!.id,
    status,
    message: !readable ? "อ่านข้อมูลจากสลิปไม่ได้ กรุณากรอกเอง" : null,
    provider: provider.label,
    ocr_confidence: ocrConfidence,
    raw_text: maskedText,
    parsed,
    category,
    counterparty,
    duplicate,
  });
});
