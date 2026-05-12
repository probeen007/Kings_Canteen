"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithRetry } from "@/lib/fetcher";
import type { Order } from "@/types/order";

const CACHE_KEY = "orders:cache:v1";
const CACHE_TTL_MS = 5 * 60 * 1000;
const VERSION_POLL_MS = 60 * 1000;

type OrdersCache = {
  fetchedAt: number;
  orders: Order[];
  version?: string;
};

function readCache(): OrdersCache | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrdersCache;
    if (!parsed?.fetchedAt || !Array.isArray(parsed.orders)) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(orders: Order[], version?: string) {
  try {
    const payload: OrdersCache = { fetchedAt: Date.now(), orders, version };
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures (private mode, storage full, etc.)
  }
}

async function fetchVersion() {
  try {
    const response = await fetchWithRetry("/api/orders/version", {
      cache: "no-store",
      credentials: "include",
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { data?: { version?: string } };
    return payload.data?.version ?? null;
  } catch {
    return null;
  }
}

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const hasLoadedRef = useRef(false);
  const versionRef = useRef<string | null>(null);
  const fetchingRef = useRef(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (showLoadingSpinner = false, force = false) => {
    if (showLoadingSpinner) setLoading(true);
    setError(null);

    if (!force) {
      const cached = readCache();
      if (cached) {
        if (!mountedRef.current) return;
        setOrders(cached.orders);
        setLoading(false);
        hasLoadedRef.current = true;
        versionRef.current = cached.version ?? null;
        void fetchVersion().then((version) => {
          if (!version) return;
          if (versionRef.current && version === versionRef.current) return;
          versionRef.current = version;
          if (mountedRef.current) {
            void loadOrders(false, true);
          }
        });
        return;
      }
    }

    try {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      const response = await fetchWithRetry("/api/orders", {
        cache: "no-store",
        credentials: "include",
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
          error?: string;
        } | null;
        if (response.status === 401 || response.status === 403) {
          throw new Error(payload?.code ?? "AUTH");
        }
        throw new Error(payload?.code ?? "orders-load");
      }
      const payload = (await response.json()) as { data?: { orders?: Order[] } };
      if (!mountedRef.current) return;
      const list = payload.data?.orders ?? [];
      setOrders(list);
      const version = await fetchVersion();
      versionRef.current = version ?? versionRef.current;
      writeCache(list, versionRef.current ?? undefined);
      hasLoadedRef.current = true;
    } catch (error) {
      if (!mountedRef.current) return;
      if (error instanceof Error && error.message === "AUTH") {
        setError("Session expired. Please sign in again.");
      } else {
        setError("Unable to load orders. Please try again.");
      }
    } finally {
      fetchingRef.current = false;
      if (mountedRef.current && showLoadingSpinner) setLoading(false);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;
    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchVersion().then((version) => {
        if (!version) return;
        if (versionRef.current && version === versionRef.current) return;
        versionRef.current = version;
        if (mountedRef.current) {
          void loadOrders(false, true);
        }
      });
    }, VERSION_POLL_MS);

    return () => clearInterval(interval);
  }, [loadOrders]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    loadOrders(true);
    return () => {
      mountedRef.current = false;
    };
  }, [loadOrders]);

  return { orders, loading, error, reload: () => loadOrders(true, true) };
}