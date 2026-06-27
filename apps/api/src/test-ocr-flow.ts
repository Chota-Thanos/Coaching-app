import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { performOcrGemini } from "./modules/current-affairs/master/ai.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

async function run() {
  console.log("Starting OCR test using Gemini API...");
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not defined. Skipping live API call.");
    process.exit(0);
  }

  // 1x1 pixel PNG
  const testBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
  
  try {
    const result = await performOcrGemini([testBase64]);
    console.log("OCR Response received successfully!");
    console.log("Extracted Text:", JSON.stringify(result));
    console.log("OCR Flow Test Completed.");
  } catch (error) {
    console.error("OCR Flow Test Failed:", error);
    process.exit(1);
  }
}

run();
