import { rateLimit } from "@/lib/redis";

export const RATE_LIMITS = {
  auth: { maxRequests: 5, windowSeconds: 15 * 60 },
  orderCreate: { maxRequests: 10, windowSeconds: 60 },
  paymentInitiate: { maxRequests: 3, windowSeconds: 5 * 60 },
  admin: { maxRequests: 100, windowSeconds: 60 },
  public: { maxRequests: 30, windowSeconds: 60 },
} as const;

export async function enforceRateLimit(key: string, maxRequests: number, windowSeconds: number) {
  const result = await rateLimit(key, maxRequests, windowSeconds);
  return result;
}
