import { ImageAnnotatorClient } from "@google-cloud/vision";

let _client: ImageAnnotatorClient | null = null;

function getClient(): ImageAnnotatorClient {
  if (!_client) {
    // Uses GOOGLE_APPLICATION_CREDENTIALS env variable (path to service account JSON)
    // or GOOGLE_CLOUD_KEY_JSON env variable for inline JSON credentials
    const keyJson = process.env.GOOGLE_CLOUD_KEY_JSON;
    if (keyJson) {
      const credentials = JSON.parse(keyJson);
      _client = new ImageAnnotatorClient({ credentials });
    } else {
      _client = new ImageAnnotatorClient();
    }
  }
  return _client;
}

/**
 * Extracts text from a single image buffer using Google Cloud Vision
 * DOCUMENT_TEXT_DETECTION is optimised for dense printed/handwritten text (ideal for UPSC question papers).
 */
export async function extractTextFromImage(buffer: Buffer): Promise<string> {
  const client = getClient();
  const [result] = await client.documentTextDetection({
    image: { content: buffer.toString("base64") }
  });
  const text = result.fullTextAnnotation?.text ?? "";
  if (!text.trim()) {
    throw new Error(
      "No text could be read from the image. Please use a clearer photo with good lighting."
    );
  }
  return text;
}

/**
 * Extracts and concatenates text from multiple images in order.
 * Separates each image's text with a visible divider so the AI parser
 * can identify page boundaries.
 */
export async function extractTextFromImages(buffers: Buffer[]): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const text = await extractTextFromImage(buffers[i]!);
    parts.push(`--- Page ${i + 1} ---\n${text}`);
  }
  return parts.join("\n\n");
}
