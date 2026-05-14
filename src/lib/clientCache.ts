/**
 * Module-level client-side cache.
 * Lives for the entire browser session — survives React unmounts/remounts.
 * Perfect for API responses that should NOT re-fetch on every page visit.
 */

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
  /** ms before considered stale (background revalidation is triggered) */
  ttl: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = new Map<string, CacheEntry<any>>();

/** Ongoing fetches — deduplicate parallel requests for the same key */
const inflight = new Map<string, Promise<unknown>>();

export const clientCache = {
  get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    const age = Date.now() - entry.fetchedAt;
    return { data: entry.data, isStale: age > entry.ttl };
  },

  set<T>(key: string, data: T, ttlMs: number) {
    store.set(key, { data, fetchedAt: Date.now(), ttl: ttlMs });
  },

  invalidate(key: string) {
    store.delete(key);
  },

  invalidatePrefix(prefix: string) {
    for (const k of store.keys()) {
      if (k.startsWith(prefix)) store.delete(k);
    }
  },

  /** Wipe entire cache — call on logout or user switch to prevent cross-user data leakage */
  clearAll() {
    store.clear();
    inflight.clear();
  },

  /**
   * Fetch with deduplication + cache.
   * - If fresh cache exists → return immediately.
   * - If stale cache exists → return stale data AND trigger background revalidation.
   * - If no cache → fetch, cache, return.
   */
  async fetchWithCache<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    onUpdate?: (data: T) => void
  ): Promise<T> {
    const cached = this.get<T>(key);

    if (cached && !cached.isStale) return cached.data;

    if (cached && cached.isStale) {
      // Return stale immediately, revalidate in background
      this.revalidate(key, fetcher, ttlMs, onUpdate);
      return cached.data;
    }

    // No cache — must fetch (deduplicate parallel calls)
    if (inflight.has(key)) return inflight.get(key) as Promise<T>;

    const promise = fetcher().then((data) => {
      this.set(key, data, ttlMs);
      inflight.delete(key);
      return data;
    }).catch((err) => {
      inflight.delete(key);
      throw err;
    });

    inflight.set(key, promise);
    return promise as Promise<T>;
  },

  /** Revalidate in the background without blocking the caller */
  revalidate<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    onUpdate?: (data: T) => void
  ) {
    if (inflight.has(key)) return; // already revalidating
    const promise = fetcher().then((data) => {
      this.set(key, data, ttlMs);
      inflight.delete(key);
      onUpdate?.(data);
    }).catch(() => inflight.delete(key));
    inflight.set(key, promise);
  },
};
