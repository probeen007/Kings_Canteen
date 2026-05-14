"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { clientCache } from "@/lib/clientCache";

/**
 * Silently polls GET /api/orders/[orderId] every 10 s.
 * If the order status becomes COMPLETED or CANCELLED, redirects to /orders.
 * This ensures a user sitting on the token page gets moved automatically
 * once staff scans and completes their order.
 */
export function TokenStatusPoller({ orderId }: { orderId: string }) {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const poll = async () => {
      if (!mountedRef.current) return;
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { data?: { status?: string } };
        const status = data?.data?.status;

        if (status === "COMPLETED") {
          clientCache.invalidate("orders:list");
          router.replace("/orders?claimed=1");
          return;
        }
        if (status === "CANCELLED") {
          clientCache.invalidate("orders:list");
          router.replace("/orders");
          return;
        }
      } catch {
        // network blip — just skip this tick
      }

      if (mountedRef.current) {
        timerRef.current = setTimeout(poll, 10_000); // poll every 10 s
      }
    };

    // First poll after 10 s (don't hammer on mount — page was just server-rendered)
    timerRef.current = setTimeout(poll, 10_000);

    // Also poll immediately when tab becomes visible again
    const onVisible = () => {
      if (!document.hidden && mountedRef.current) {
        if (timerRef.current) clearTimeout(timerRef.current);
        poll();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [orderId, router]);

  return null; // renders nothing
}
