import { Redis } from "@upstash/redis";

import { env } from "@/lib/env";

const globalForRedis = globalThis as unknown as {
redis?: any;
};

function createInMemoryRedisStub() {
const store = new Map<string, any>();
return {
async get(key: string) {
return store.get(key) ?? null;
},
async set(key: string, value: any, opts?: { ex?: number }) {
store.set(key, value);
return true;
},
async incr(key: string) {
const val = Number(store.get(key) ?? 0) + 1;
store.set(key, val);
return val;
},
async expire(key: string, seconds: number) {
return true;
},
async del(...keys: string[]) {
for (const k of keys) store.delete(k);
return true;
},
async ttl(key: string) {
return -1;
},
};
}

let redisClient: any;

if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
  console.warn("[Upstash Redis] URL or token missing — using in-memory stub for dev");
  redisClient = createInMemoryRedisStub();
} else {
  const upstash =
    globalForRedis.redis ??
    new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });

  if (process.env.NODE_ENV !== "production") {
    globalForRedis.redis = upstash;
  }

  // Wrap every method with a 3-second timeout.
  // When Upstash hostname is unreachable, DNS failure takes 10-15 s by default.
  // This proxy makes the fallback kick in almost immediately.
  const stub = createInMemoryRedisStub();
  const TIMEOUT_MS = 3_000;

  redisClient = new Proxy(upstash, {
    get(target, prop) {
      const orig = (target as any)[prop];
      if (typeof orig !== "function") return orig;
      return (...args: any[]) => {
        const call = orig.apply(target, args) as Promise<any>;
        const timeout = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Redis timeout")), TIMEOUT_MS)
        );
        return Promise.race([call, timeout]).catch((err) => {
          // Re-throw so callers' own catch blocks / fallback logic runs
          throw err;
        });
      };
    },
  });
}

export const redis = redisClient;


const fallbackRateLimitStore = new Map<string, { count: number; resetAt: number }>();

function fallbackRateLimit(key: string, maxRequests: number, windowSeconds: number) {
	const now = Date.now();
	const existing = fallbackRateLimitStore.get(key);
	if (!existing || existing.resetAt <= now) {
		const resetAt = now + windowSeconds * 1000;
		fallbackRateLimitStore.set(key, { count: 1, resetAt });
		return { allowed: true, remaining: maxRequests - 1, resetAt };
	}
	const count = existing.count + 1;
	existing.count = count;
	return {
		allowed: count <= maxRequests,
		remaining: Math.max(0, maxRequests - count),
		resetAt: existing.resetAt,
	};
}

export async function rateLimit(key: string, maxRequests: number, windowSeconds: number) {
	try {
		const count = await redis.incr(key);
		if (count === 1) {
			await redis.expire(key, windowSeconds);
		}

		const ttl = await redis.ttl(key);
		const resetAt = Date.now() + Math.max(ttl, 0) * 1000;

		return {
			allowed: count <= maxRequests,
			remaining: Math.max(0, maxRequests - count),
			resetAt,
		};
	} catch (error) {
		console.error("rateLimit failed, using fallback limiter", error);
		return fallbackRateLimit(key, maxRequests, windowSeconds);
	}
}

export async function getQueuePosition(pickupSlot: string, expirySeconds = 24 * 60 * 60) {
try {
	const key = `queue:${pickupSlot}`;
	const position = await redis.incr(key);
	if (position === 1) {
		await redis.expire(key, expirySeconds);
	}
	return position;
} catch (error) {
	console.error("queue position unavailable, falling back", error);
	return 1;
}
}

export async function setOrderCache(orderId: string, data: unknown, ttlSeconds: number) {
  try {
    const key = `order:${orderId}`;
    await redis.set(key, data, { ex: ttlSeconds });
  } catch (err) {
    console.warn("setOrderCache failed (Redis unreachable), skipping cache", err);
  }
}

export async function getOrderCache<T>(orderId: string) {
  try {
    const key = `order:${orderId}`;
    return (await redis.get(key)) as T | null;
  } catch {
    return null;
  }
}

export async function invalidateOrderCache(orderId: string) {
  try {
    await redis.del(orderId);
  } catch {
    // non-fatal — cache will expire naturally
  }
}
