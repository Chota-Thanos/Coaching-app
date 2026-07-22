import { createRequire } from "module";
import mammoth from "mammoth";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { performOcrGemini, hasAiCredentials } from "./ai.service.js";

const require = createRequire(import.meta.url);
// pdf-parse ships as CommonJS; load it the same way the assessment parser does.
const pdf = require("pdf-parse") as (buffer: Buffer) => Promise<{ text: string }>;

const WORD_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword"
]);

const IMAGE_MIME_PREFIX = "image/";

export interface ExtractedSource {
  /** Plain text extracted from the document or web page. */
  text: string;
  /** Best-effort title detected from the source (page title, Word heading, etc). */
  detected_title?: string;
  /** Human-readable source label (site name, filename). */
  source_name?: string;
  /** Canonical URL when the source was a web page. */
  source_url?: string;
  /** How the text was obtained, useful for diagnostics in the admin UI. */
  extraction_method: "pdf" | "pdf_ocr" | "word" | "image_ocr" | "url" | "plain_text";
}

// Below this, a digital PDF is treated as scanned and routed to OCR.
const MIN_DIGITAL_PDF_CHARS = 40;

function stripBase64Prefix(data: string): string {
  return data.replace(/^data:[^;]+;base64,/, "");
}

/**
 * Extracts plain text from an uploaded Word/PDF/image document (base64 encoded).
 * Mirrors the proven extraction path used by the assessment quiz parser, adding
 * an image-OCR branch for screenshots and scanned single pages.
 */
export async function extractFromDocument(input: {
  base64_data: string;
  mime_type: string;
  filename?: string;
}): Promise<ExtractedSource> {
  const buffer = Buffer.from(stripBase64Prefix(input.base64_data), "base64");
  const sourceName = input.filename;

  if (input.mime_type === "application/pdf") {
    let text = "";
    try {
      const data = await pdf(buffer);
      text = (data.text ?? "").trim();
    } catch {
      text = "";
    }
    if (text.length >= MIN_DIGITAL_PDF_CHARS) {
      return { text, source_name: sourceName, extraction_method: "pdf" };
    }
    // Scanned / image-only PDF → OCR. Gemini & Vertex accept a PDF natively as an
    // inlineData part, so we hand the whole PDF over rather than rasterising it.
    if (!hasAiCredentials()) {
      throw new Error(
        "This looks like a scanned PDF with no selectable text, and OCR needs AI credentials configured on the server."
      );
    }
    const pdfDataUrl = `data:application/pdf;base64,${stripBase64Prefix(input.base64_data)}`;
    const ocrText = (await performOcrGemini([pdfDataUrl])).trim();
    if (!ocrText) {
      throw new Error("Could not extract any text from this scanned PDF.");
    }
    return { text: ocrText, source_name: sourceName, extraction_method: "pdf_ocr" };
  }

  if (WORD_MIME_TYPES.has(input.mime_type)) {
    const result = await mammoth.extractRawText({ buffer });
    return { text: (result.value ?? "").trim(), source_name: sourceName, extraction_method: "word" };
  }

  if (input.mime_type.startsWith(IMAGE_MIME_PREFIX)) {
    if (!hasAiCredentials()) {
      throw new Error("Image OCR needs AI credentials configured on the server.");
    }
    const text = (await performOcrGemini([stripBase64Prefix(input.base64_data)])).trim();
    return { text, source_name: sourceName, extraction_method: "image_ocr" };
  }

  // Fallback: treat as UTF-8 text (e.g. .txt).
  return { text: buffer.toString("utf-8").trim(), source_name: sourceName, extraction_method: "plain_text" };
}

/**
 * Fetches a web page and extracts the main article text using Mozilla Readability,
 * the same engine Firefox Reader View uses. Falls back to a crude tag strip if
 * Readability cannot isolate an article body.
 */
export async function extractFromUrl(url: string): Promise<ExtractedSource> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
  });
  if (!res.ok) {
    throw new Error(`Could not fetch the URL (status ${res.status}).`);
  }
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  let text = (article?.textContent ?? "").trim();
  if (!text) {
    // Readability failed (paywall wrapper, unusual markup) — strip tags manually.
    text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const host = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return undefined;
    }
  })();

  return {
    text,
    detected_title: article?.title?.trim() || undefined,
    source_name: article?.siteName?.trim() || host,
    source_url: url,
    extraction_method: "url"
  };
}
