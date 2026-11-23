"use client";
import jsQR from "jsqr";

export const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 5 * 1024 * 1024;

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("เปิดรูปไม่ได้"));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/** Read the slip's verification QR code in the browser (gives a reliable reference number). */
export async function readQr(file: Blob): Promise<string | null> {
  try {
    const img = await loadImage(file);
    for (const side of [1400, 900]) {
      const { canvas, ctx } = draw(img, side);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(d.data, d.width, d.height, { inversionAttempts: "dontInvert" });
      if (code?.data) return code.data;
    }
  } catch {
    /* QR is optional */
  }
  return null;
}

/** Shrink very large photos (e.g. from a phone camera) to a JPEG under the size limit. */
export async function prepareImage(file: File): Promise<File> {
  if (file.size <= MAX_BYTES && ACCEPTED.includes(file.type)) return file;
  const img = await loadImage(file);
  for (const [side, q] of [[2400, 0.9], [1800, 0.85], [1400, 0.8]] as const) {
    const { canvas } = draw(img, side);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, "image/jpeg", q));
    if (blob && blob.size <= MAX_BYTES) return new File([blob], "slip.jpg", { type: "image/jpeg" });
  }
  throw new Error("รูปใหญ่เกินไป กรุณาใช้รูปที่เล็กกว่า 5 MB");
}
