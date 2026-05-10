"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/types/order";

const ACTIVE_STATUSES = new Set(["CONFIRMED", "PREPARING", "READY"]);
const POLL_INTERVAL_MS = 15_000; // 15 s — fast enough to feel live, cheap enough to not hammer DB

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mountedRef = useRef(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async (showLoadingSpinner = false) => {
    if (showLoadingSpinner) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      if (!response.ok) throw new Error("orders-load");
      const payload = (await response.json()) as { data?: { orders?: Order[] } };
      if (!mountedRef.current) return;
      setOrders(payload.data?.orders ?? []);
    } catch {
      if (!mountedRef.current) return;
      setError("Unable to load orders. Please try again.");
    } finally {
      if (mountedRef.current && showLoadingSpinner) setLoading(false);
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // ── Smart polling ─────────────────────────────────────────────────────────
  // Only poll while:
  //   1. The tab is visible (Page Visibility API)
  //   2. There are orders in an active state (CONFIRMED / PREPARING / READY)
  // When either condition drops, polling stops automatically.

  const scheduleNextPoll = useCallback(
    (currentOrders: Order[]) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      const hasActiveOrders = currentOrders.some((o) => ACTIVE_STATUSES.has(o.status));
      const tabVisible = !document.hidden;

      if (!hasActiveOrders || !tabVisible) return; // nothing to poll for

      timerRef.current = setTimeout(async () => {
        if (!mountedRef.current) return;
        await loadOrders(false); // silent refresh — no loading spinner
      }, POLL_INTERVAL_MS);
    },
    [loadOrders]
  );

  // Re-schedule poll whenever orders change
  useEffect(() => {
    scheduleNextPoll(orders);
  }, [orders, scheduleNextPoll]);

  // Pause / resume polling when tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Tab just became visible — refresh immediately then resume scheduling
        loadOrders(false);
      } else {
        // Tab hidden — cancel pending poll
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [loadOrders]);

  // Initial load
  useEffect(() => {
    mountedRef.current = true;
    loadOrders(true);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadOrders]);

  return { orders, loading, error, reload: () => loadOrders(true) };
}