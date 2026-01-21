import { z } from "zod";
import { createEnv } from "./index";

// cspell:disable

/**
 * Vercel System Environment Variables
 * @see https://vercel.com/docs/projects/environment-variables/system-environment-variables
 */
export const vercel = () =>
  createEnv({
    server: {
      VERCEL: z.string().optional(),
      CI: z.string().optional(),
      VERCEL_ENV: z.enum(["development", "preview", "production"]).optional(),
      VERCEL_TARGET_ENV: z.string().optional(),
      VERCEL_URL: z.string().optional(),
      VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
      VERCEL_BRANCH_URL: z.string().optional(),
      VERCEL_REGION: z.string().optional(),
      VERCEL_DEPLOYMENT_ID: z.string().optional(),
      VERCEL_SKEW_PROTECTION_ENABLED: z.string().optional(),
      VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
      VERCEL_GIT_PROVIDER: z.string().optional(),
      VERCEL_GIT_REPO_SLUG: z.string().optional(),
      VERCEL_GIT_REPO_OWNER: z.string().optional(),
      VERCEL_GIT_REPO_ID: z.string().optional(),
      VERCEL_GIT_COMMIT_REF: z.string().optional(),
      VERCEL_GIT_COMMIT_SHA: z.string().optional(),
      VERCEL_GIT_COMMIT_MESSAGE: z.string().optional(),
      VERCEL_GIT_COMMIT_AUTHOR_LOGIN: z.string().optional(),
      VERCEL_GIT_COMMIT_AUTHOR_NAME: z.string().optional(),
      VERCEL_GIT_PREVIOUS_SHA: z.string().optional(),
      VERCEL_GIT_PULL_REQUEST_ID: z.string().optional(),
    },
    vars: process.env,
  });

/**
 * Neon for Vercel Environment Variables
 * @see https://neon.tech/docs/guides/vercel-native-integration
 */
export const neonVercel = () =>
  createEnv({
    server: {
      DATABASE_URL: z.string(),
      DATABASE_URL_UNPOOLED: z.string().optional(),
      PGHOST: z.string().optional(),
      PGHOST_UNPOOLED: z.string().optional(),
      PGUSER: z.string().optional(),
      PGDATABASE: z.string().optional(),
      PGPASSWORD: z.string().optional(),
      POSTGRES_URL: z.url().optional(),
      POSTGRES_URL_NON_POOLING: z.url().optional(),
      POSTGRES_USER: z.string().optional(),
      POSTGRES_HOST: z.string().optional(),
      POSTGRES_PASSWORD: z.string().optional(),
      POSTGRES_DATABASE: z.string().optional(),
      POSTGRES_URL_NO_SSL: z.url().optional(),
      POSTGRES_PRISMA_URL: z.url().optional(),
    },
    vars: process.env,
  });

/**
 * Supabase for Vercel Environment Variables
 * @see https://vercel.com/marketplace/supabase
 */
export const supabaseVercel = () =>
  createEnv({
    prefix: "NEXT_PUBLIC_",
    server: {
      POSTGRES_URL: z.url(),
      POSTGRES_PRISMA_URL: z.url().optional(),
      POSTGRES_URL_NON_POOLING: z.url().optional(),
      POSTGRES_USER: z.string().optional(),
      POSTGRES_HOST: z.string().optional(),
      POSTGRES_PASSWORD: z.string().optional(),
      POSTGRES_DATABASE: z.string().optional(),
      SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
      SUPABASE_ANON_KEY: z.string().optional(),
      SUPABASE_URL: z.url().optional(),
      SUPABASE_JWT_SECRET: z.string().optional(),
    },
    client: {
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
      NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
    },
    vars: process.env,
  });

/**
 * Upstash redis Environment Variables
 * @see https://upstash.com/docs/redis/howto/connectwithupstashredis
 */
export const upstashRedis = () =>
  createEnv({
    server: {
      UPSTASH_REDIS_REST_URL: z.url(),
      UPSTASH_REDIS_REST_TOKEN: z.string(),
    },
    vars: process.env,
  });

/**
 * Vite Environment Variables
 * @see https://vite.dev/guide/env-and-mode
 */
export const vite = () =>
  createEnv({
    server: {
      BASE_URL: z.string(),
      MODE: z.string(),
      DEV: z.boolean(),
      PROD: z.boolean(),
      SSR: z.boolean(),
    },
    vars: import.meta.env,
  });
