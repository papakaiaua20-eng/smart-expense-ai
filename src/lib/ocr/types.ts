export type OcrResult = { text: string; confidence: number | null };

export interface OcrProvider {
  id: string;
  label: string;
  /** true when the image leaves our server (needs user notice/consent under PDPA) */
  external: boolean;
  recognize(image: Buffer, mimeType: string): Promise<OcrResult>;
}

export class OcrNotConfiguredError extends Error {
  constructor(message = "ยังไม่ได้ตั้งค่าบริการ OCR") {
    super(message);
    this.name = "OcrNotConfiguredError";
  }
}
