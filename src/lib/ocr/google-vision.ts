import type { OcrProvider } from "./types";

// Google Cloud Vision DOCUMENT_TEXT_DETECTION (good Thai accuracy).
// Needs GOOGLE_VISION_API_KEY. Images are sent to Google: the scan page tells the user this.
export function googleVisionProvider(apiKey: string): OcrProvider {
  return {
    id: "google-vision",
    label: "Google Cloud Vision",
    external: true,
    async recognize(image) {
      const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [
            {
              image: { content: image.toString("base64") },
              features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
              imageContext: { languageHints: ["th", "en"] },
            },
          ],
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) throw new Error(`Google Vision error ${res.status}`);
      const json = (await res.json()) as {
        responses?: { fullTextAnnotation?: { text?: string; pages?: { confidence?: number }[] }; error?: { message: string } }[];
      };
      const r = json.responses?.[0];
      if (r?.error) throw new Error(r.error.message);
      const conf = r?.fullTextAnnotation?.pages?.[0]?.confidence;
      return { text: r?.fullTextAnnotation?.text ?? "", confidence: typeof conf === "number" ? conf : null };
    },
  };
}
