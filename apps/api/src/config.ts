import { resolve } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ path: resolve(process.cwd(), ".env") });
dotenv.config({ path: resolve(process.cwd(), "../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1).default("postgres://postgres:postgres@localhost:5432/coaching_app"),
  CORS_ORIGIN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-before-production"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  GOOGLE_CLIENT_ID_WEB: z.string().optional(),
  GOOGLE_CLIENT_ID_ANDROID: z.string().optional(),
  GOOGLE_CLIENT_ID_IOS: z.string().optional()
});

const parsed = envSchema.parse(process.env);

if (parsed.NODE_ENV === "production" && parsed.JWT_SECRET === "development-only-secret-change-before-production") {
  throw new Error("SECURITY ERROR: JWT_SECRET must be explicitly configured in production environments.");
}

export const config = {
  ...parsed,
  corsOrigins: parsed.CORS_ORIGIN
    ? parsed.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
    : []
};
