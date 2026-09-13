import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.string().default("info"),
  JWT_SECRET: z.string().min(16).default("dev-only-change-me-now-32"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  REDIS_URL: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  AI_BASE_URL: z.string().default("https://api.openai.com/v1"),
  AI_MODEL: z.string().default("gpt-4o-mini"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_DIR: z.string().default("./uploads"),
  STORAGE_BUCKET: z.string().optional().default(""),
  STORAGE_REGION: z.string().optional().default(""),
  STORAGE_ACCESS_KEY: z.string().optional().default(""),
  STORAGE_SECRET_KEY: z.string().optional().default(""),
  STORAGE_ENDPOINT: z.string().optional().default(""),
  STORAGE_PUBLIC_URL: z.string().optional().default(""),
  APPLICATION_MAX_PER_DAY: z.coerce.number().default(10),
  APPLICATION_MAX_EXECUTION_ATTEMPTS: z.coerce.number().default(3),
  JOB_SEARCH_INTERVAL_HOURS: z.coerce.number().default(6),
  MAX_UPLOAD_MB: z.coerce.number().default(8),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().default(120),
  AI_TIMEOUT_MS: z.coerce.number().default(20_000),
  QUEUE_STALE_LOCK_MS: z.coerce.number().default(5 * 60_000),
});

export function assertProductionSecrets(values: { NODE_ENV: string }, raw = process.env) {
  if (values.NODE_ENV !== "production") return;
  const secret = raw.JWT_SECRET ?? "";
  if (!secret || secret === "dev-only-change-me-now-32" || secret.length < 32) {
    throw new Error("JWT_SECRET must be a unique 32+ character value in production");
  }
}

export const env = envSchema.parse(process.env);
assertProductionSecrets(env);
export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";
