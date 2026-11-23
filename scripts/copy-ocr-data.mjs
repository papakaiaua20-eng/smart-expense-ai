// Copies Tesseract language data (Thai + English) from node_modules into ./ocr-data
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const out = path.resolve("ocr-data");
mkdirSync(out, { recursive: true });
for (const lang of ["tha", "eng"]) {
  try {
    const dir = path.dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`));
    const src = path.join(dir, "4.0.0_best_int", `${lang}.traineddata.gz`);
    if (existsSync(src)) copyFileSync(src, path.join(out, `${lang}.traineddata.gz`));
  } catch {
    console.warn(`[ocr-data] @tesseract.js-data/${lang} not installed; skipping`);
  }
}
