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
redisClient =
globalForRedis.redis ??
new Redis({
url: env.UPSTASH_REDIS_REST_URL,
token: env.UPSTASH_REDIS_REST_TOKEN,
});

if (process.env.NODE_ENV !== "production") {
globalForRedis.redis = redisClient;
}
}

export const redis = redisClient;

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
	console.error("rateLimit failed, allowing request", error);
	return {
		allowed: true,
		remaining: maxRequests,
		resetAt: Date.now() + windowSeconds * 1000,
	};
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
const key = `order:${orderId}`;
await redis.set(key, data, { ex: ttlSeconds });
}

export async function getOrderCache<T>(orderId: string) {
const key = `order:${orderId}`;
return redis.get<T>(key);
}

export async function invalidateOrderCache(orderId: string) {
const key = `order:${orderId}`;
await redis.del(orderId);
}
