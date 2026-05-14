"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/types/order";
import { clientCache } from "@/lib/clientCache";

const CACHE_KEY = "orders:list";
const TTL_MS = 30_000;          // 30 s — fresh window (no refetch if within this)
const POLL_INTERVAL_MS = 15_000; // poll when active orders exist + tab visible

const ACTIVE_STATUSES = new Set(["CONFIRMED", "PREPARING", "READY"]);

async function fetchOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders", { cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error(`orders-load: ${res.status}`);
  const payload = (await res.json()) as { data?: { orders?: Order[] } };
  return payload.data?.orders ?? [];
}

export function useOrders() {
  // Initialise state from cache immediately — zero-delay render on revisit
  const cached = clientCache.get<Order[]>(CACHE_KEY);
  const [orders, setOrders] = useState<Order[]>(cached?.data ?? []);
  const [loading, setLoading] = useState(!cached);   // only show spinner if no cache at all
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Core load ────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const data = await clientCache.fetchWithCache(
        CACHE_KEY,
        fetchOrders,
        TTL_MS,
        (fresh) => {
          if (mountedRef.current) setOrders(fresh);
        }
      );
      if (mountedRef.current) {
        setOrders(data);
        setLoading(false);
      }
    } catch {
      if (mountedRef.current) {
        setError("Unable to load orders. Please try again.");
        setLoading(false);
      }
    }
  }, []);

  // ── Smart polling — only while tab visible + active orders exist ──────────
  const scheduleNextPoll = useCallback((currentOrders: Order[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const hasActive = currentOrders.some((o) => ACTIVE_STATUSES.has(o.status));
    if (!hasActive || document.hidden) return;
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      // Force revalidation (ignore TTL) for active orders — status changes matter
      clientCache.invalidate(CACHE_KEY);
      await loadOrders(false);
    }, POLL_INTERVAL_MS);
  }, [loadOrders]);

  useEffect(() => { scheduleNextPoll(orders); }, [orders, scheduleNextPoll]);

  // Tab visibility: refresh immediately on focus if cache is stale
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) {
        if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      } else {
        const entry = clientCache.get<Order[]>(CACHE_KEY);
        if (!entry || entry.isStale) loadOrders(false);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loadOrders]);

  // ── Mount: serve cache instantly, revalidate if stale ────────────────────
  useEffect(() => {
    mountedRef.current = true;
    const entry = clientCache.get<Order[]>(CACHE_KEY);
    if (!entry) {
      loadOrders(true);        // no cache — full fetch
    } else if (entry.isStale) {
      setOrders(entry.data);   // show stale immediately
      setLoading(false);
      loadOrders(false);       // revalidate in background
    } else {
      setOrders(entry.data);   // fresh cache — done, no fetch
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadOrders]);

  /** Call this after placing an order or any mutation to force a fresh fetch */
  const invalidateAndReload = useCallback(() => {
    clientCache.invalidate(CACHE_KEY);
    loadOrders(true);
  }, [loadOrders]);

  return {
    orders,
    loading,
    error,
    reload: () => loadOrders(true),
    invalidateAndReload,
  };
}

/** Warm the orders cache in the background (call from prefetcher) */
export function prefetchOrders() {
  const entry = clientCache.get<Order[]>(CACHE_KEY);
  if (!entry || entry.isStale) {
    clientCache.revalidate(CACHE_KEY, fetchOrders, TTL_MS);
  }
}