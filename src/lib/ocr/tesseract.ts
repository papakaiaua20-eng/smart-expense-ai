import path from "node:path";
import os from "node:os";
import type { OcrProvider } from "./types";

// Local OCR with Tesseract (Thai + English). Runs on our own server: images are not sent anywhere.
// Language data is bundled in /ocr-data (copied from @tesseract.js-data by `npm run postinstall`).

type TesseractWorker = {
  recognize: (img: Buffer) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

const g = globalThis as unknown as { __tessWorker?: Promise<TesseractWorker> };

async function getWorker(): Promise<TesseractWorker> {
  if (!g.__tessWorker) {
    g.__tessWorker = (async () => {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["tha", "eng"], 1, {
        langPath: path.join(process.cwd(), "ocr-data"),
        cachePath: path.join(os.tmpdir(), "tesseract-cache"),
        gzip: true,
      });
      return worker as unknown as TesseractWorker;
    })().catch((e) => {
      g.__tessWorker = undefined;
      throw e;
    });
  }
  return g.__tessWorker;
}

export function tesseractProvider(): OcrProvider {
  return {
    id: "tesseract",
    label: "Tesseract OCR (ประมวลผลบนเซิร์ฟเวอร์ของเว็บเอง)",
    external: false,
    async recognize(image) {
      const worker = await getWorker();
      const { data } = await worker.recognize(image);
      return { text: data.text ?? "", confidence: typeof data.confidence === "number" ? data.confidence / 100 : null };
    },
  };
}
