import "server-only";
import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  LAZADA_APP_KEY: z.string().min(1, "Lazada App Key is required"),
  LAZADA_APP_SECRET: z.string().min(1, "Lazada App Secret is required"),
  LAZADA_REDIRECT_URI: z.string().url().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1).optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  LAZADA_APP_KEY: process.env.LAZADA_APP_KEY,
  LAZADA_APP_SECRET: process.env.LAZADA_APP_SECRET,
  LAZADA_REDIRECT_URI: process.env.LAZADA_REDIRECT_URI,
  VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  NODE_ENV: process.env.NODE_ENV,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map(({ path, message }) => `${path.join(".")}: ${message}`)
    .join("\n");
  console.error(`Invalid environment variables:\n${issues}`);
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
