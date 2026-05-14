"use client";

/**
 * AppPrefetcher — mounted once in the root layout.
 * Drives two kinds of prefetching:
 *
 * 1. PAGE prefetching (Next.js router.prefetch):
 *    Loads the JS bundle + server component data for the route into the router cache.
 *    Navigating to a prefetched page is instant (no loading flash).
 *
 * 2. DATA prefetching (clientCache warm-up):
 *    Fetches API data into the module-level clientCache so hooks like useOrders
 *    return cached data immediately on mount — no spinner on re-visit.
 *
 * Strategy:
 *   Logged-in user on /menu     → prefetch /orders, /cart, /checkout pages + orders data
 *   Logged-in user on /orders   → prefetch /menu, token pages for active orders
 *   Any logged-in user          → keep orders data warm (re-warm when stale)
 */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { prefetchOrders } from "@/hooks/useOrders";
import type { Order } from "@/types/order";
import { clientCache } from "@/lib/clientCache";

const ORDERS_CACHE_KEY = "orders:list";

export function AppPrefetcher() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const prefetchedTokens = useRef(new Set<string>());

  const isUser = status === "authenticated" && session?.user?.role === "USER";

  // ── Page-level prefetch based on current route ────────────────────────────
  useEffect(() => {
    if (!isUser) return;

    if (pathname === "/menu" || pathname === "/") {
      router.prefetch("/orders");
      router.prefetch("/cart");
      router.prefetch("/checkout");
    }

    if (pathname === "/orders") {
      router.prefetch("/menu");
      router.prefetch("/cart");
      router.prefetch("/checkout");
    }

    if (pathname === "/cart") {
      router.prefetch("/checkout");
      router.prefetch("/menu");
    }

    if (pathname === "/checkout") {
      router.prefetch("/orders");
    }
  }, [isUser, pathname, router]);

  // ── Data prefetch: warm orders cache on login + on route change ───────────
  useEffect(() => {
    if (!isUser) return;
    prefetchOrders();
  }, [isUser, pathname]);

  // ── Token page prefetch: for each active/pending order ────────────────────
  // When on the orders page, prefetch token pages for orders the user will tap
  useEffect(() => {
    if (!isUser || pathname !== "/orders") return;

    const orders = clientCache.get<Order[]>(ORDERS_CACHE_KEY)?.data;
    if (!orders?.length) return;

    const toBeReceived = (orders || []).filter((o) =>
      ["CONFIRMED", "PREPARING", "READY"].includes(o.status)
    );

    for (const order of toBeReceived) {
      if (!prefetchedTokens.current.has(order.id)) {
        prefetchedTokens.current.add(order.id);
        router.prefetch(`/token/${order.id}`);
      }
    }
  }, [isUser, pathname, router]);

  // When orders data is freshly loaded, trigger token prefetch
  // (orders may not be in cache yet when the effect above first runs)
  useEffect(() => {
    if (!isUser || pathname !== "/orders") return;

    const interval = setInterval(() => {
      const orders = clientCache.get<Order[]>(ORDERS_CACHE_KEY)?.data;
      if (!orders) return;
      clearInterval(interval); // stop once we have data

      (orders || [])
        .filter((o) => ["CONFIRMED", "PREPARING", "READY"].includes(o.status))
        .forEach((o) => {
          if (!prefetchedTokens.current.has(o.id)) {
            prefetchedTokens.current.add(o.id);
            router.prefetch(`/token/${o.id}`);
          }
        });
    }, 300);

    return () => clearInterval(interval);
  }, [isUser, pathname, router]);

  return null; // renders nothing
}
