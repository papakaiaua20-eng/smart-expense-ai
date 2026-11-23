import { googleVisionProvider } from "./google-vision";
import { tesseractProvider } from "./tesseract";
import { OcrNotConfiguredError, type OcrProvider } from "./types";

export * from "./types";

/**
 * OCR_PROVIDER = "tesseract" (default, local, free) | "google-vision" (needs GOOGLE_VISION_API_KEY) | "none"
 * Add another engine by implementing OcrProvider and registering it here.
 */
export function getOcrProvider(): OcrProvider | null {
  const id = (process.env.OCR_PROVIDER ?? "tesseract").trim().toLowerCase();
  if (id === "none") return null;
  if (id === "google-vision") {
    const key = process.env.GOOGLE_VISION_API_KEY;
    return key ? googleVisionProvider(key) : null;
  }
  if (id === "tesseract") return tesseractProvider();
  return null;
}

export function requireOcrProvider(): OcrProvider {
  const p = getOcrProvider();
  if (!p) throw new OcrNotConfiguredError();
  return p;
}
