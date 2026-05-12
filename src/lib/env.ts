import { z } from "zod";

const serverSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  NEXTAUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(32),
  ESEWA_SECRET_KEY: z.string().min(1),
  ESEWA_MERCHANT_CODE: z.string().min(1),
  ESEWA_BASE_URL: z.string().url(),
  ESEWA_VERIFY_URL: z.string().url().optional(),
  SPARROW_SMS_TOKEN: z.string().min(1).optional(),
  SPARROW_SMS_FROM: z.string().min(1).optional(),
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_EMAIL: z.string().email().optional(),
});

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SOCKET_URL: z.string().url().optional(),
}).partial({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: true,
  NEXT_PUBLIC_SOCKET_URL: true,
});

const serverEnvResult = serverSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  JWT_SECRET: process.env.JWT_SECRET,
  ESEWA_SECRET_KEY: process.env.ESEWA_SECRET_KEY,
  ESEWA_MERCHANT_CODE: process.env.ESEWA_MERCHANT_CODE,
  ESEWA_BASE_URL: process.env.ESEWA_BASE_URL,
  ESEWA_VERIFY_URL: process.env.ESEWA_VERIFY_URL,
  SPARROW_SMS_TOKEN: process.env.SPARROW_SMS_TOKEN,
  SPARROW_SMS_FROM: process.env.SPARROW_SMS_FROM,
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY,
  VAPID_EMAIL: process.env.VAPID_EMAIL,
});

const publicEnvResult = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL,
});

if (!publicEnvResult.success) {
  console.error("Missing/invalid public env vars:", publicEnvResult.error.flatten().fieldErrors);
  throw new Error(
    "Invalid public environment variables: " +
      JSON.stringify(publicEnvResult.error.flatten().fieldErrors)
  );
}

if (typeof window === "undefined" && !serverEnvResult.success) {
  console.error("Missing/invalid server env vars:", serverEnvResult.error.flatten().fieldErrors);
  throw new Error(
    "Invalid server environment variables: " +
      JSON.stringify(serverEnvResult.error.flatten().fieldErrors)
  );
}

export const env = {
  ...(typeof window === "undefined" && serverEnvResult.success
    ? serverEnvResult.data
    : {}),
  ...publicEnvResult.data,
};