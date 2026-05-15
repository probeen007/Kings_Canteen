"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { useCart } from "@/hooks/useCart";
import { useOrders } from "@/hooks/useOrders";
import type { Order } from "@/types/order";
import {
  Clock,
  QrCode,
  ShoppingBag,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  UtensilsCrossed,
  Loader2,
} from "lucide-react";

// ── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  CONFIRMED: "bg-blue-100 text-blue-800",
  PREPARING: "bg-amber-100 text-amber-800",
  READY: "bg-green-100 text-green-800",
  COMPLETED: "bg-slate-100 text-slate-600",
  PENDING: "bg-yellow-100 text-yellow-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready to Collect",
  COMPLETED: "Delivered",
  PENDING: "Pending",
  CANCELLED: "Cancelled",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="h-4 w-32 rounded bg-slate-100" />
      <div className="h-3 w-52 rounded bg-slate-100" />
      <div className="h-9 w-full rounded bg-slate-100" />
    </div>
  );
}

// ── To-Be-Received card ───────────────────────────────────────────────────────

function PendingPickupCard({ order, onReorder }: { order: Order; onReorder: (o: Order) => void }) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const pickupDate = new Date(order.pickupTime);
  const isReady = order.status === "READY";

  return (
    <div className={`rounded-2xl border bg-white shadow-sm overflow-hidden ${isReady ? "border-green-300 ring-2 ring-green-200" : "border-slate-200"}`}>
      {isReady && (
        <div className="bg-green-500 px-4 py-2 text-center text-xs font-semibold text-white">
          🎉 Your order is READY — please collect now!
        </div>
      )}
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">Kings Canteen</p>
            <p className="mt-1 text-base font-bold text-slate-900">#{order.orderNumber}</p>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                {order.isAsap
                  ? "Pickup ASAP"
                  : `Pickup ${pickupDate.toLocaleString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`}
              </span>
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Items */}
        <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
          {order.items.slice(0, 3).map((item) => (
            <div key={item.id} className="flex justify-between text-xs text-slate-600">
              <span>{item.quantity}× {item.name}</span>
              <span className="font-medium">Rs. {item.subtotal.toLocaleString()}</span>
            </div>
          ))}
          {order.items.length > 3 && (
            <p className="text-xs text-slate-400">+{order.items.length - 3} more items</p>
          )}
          <div className="flex justify-between border-t border-slate-100 pt-2 text-sm font-semibold text-slate-900">
            <span>Total</span>
            <span>Rs. {order.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => {
              setIsNavigating(true);
              router.push(`/token/${order.id}`);
            }}
            disabled={isNavigating}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isNavigating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            {isNavigating ? "Loading..." : "Show QR / Token"}
          </button>
          <button
            onClick={() => onReorder(order)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reorder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Received card ─────────────────────────────────────────────────────────────

function ReceivedCard({ order, onReorder }: { order: Order; onReorder: (o: Order) => void }) {
  const pickupDate = new Date(order.pickupTime);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900">#{order.orderNumber}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span>
              {order.isAsap
                ? "Pickup ASAP"
                : pickupDate.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {order.items.length} item{order.items.length !== 1 ? "s" : ""} · Rs. {order.totalAmount.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusBadge status={order.status} />
          <button
            onClick={() => onReorder(order)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-3 w-3" /> Reorder
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, title, body, cta }: {
  icon: React.ElementType;
  title: string;
  body: string;
  cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Icon className="h-7 w-7 text-slate-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-slate-700">{title}</h3>
      <p className="mt-1 text-xs text-slate-400">{body}</p>
      {cta && <div className="mt-4">{cta}</div>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function OrdersPageContent() {
  const { orders, loading, error, reload } = useOrders();
  const { addItem } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [navigatingToMenu, setNavigatingToMenu] = useState(false);

  useEffect(() => {
    router.prefetch("/menu");
    router.prefetch("/cart");
    router.prefetch("/checkout");
  }, [router]);

  // Show toast if redirected from a claimed token page
  useEffect(() => {
    if (searchParams.get("claimed") === "1") {
      toast.success("Order already delivered — see your history below.");
      // Clean up the query param without navigation
      window.history.replaceState({}, "", "/orders");
    }
  }, [searchParams]);

  const handleReorder = (order: Order) => {
    order.items.forEach((item) => {
      addItem(
        {
          id: item.menuItemId,
          name: item.name,
          description: null,
          price: item.unitPrice,
          imageUrl: null,
          isAvailable: true,
          preparationMins: 10,
        },
        item.quantity
      );
    });
    router.push("/cart");
  };

  // Split orders into the two sections
  const toBeReceived = (orders || []).filter((o) =>
    ["CONFIRMED", "PREPARING", "READY"].includes(o.status)
  );
  // Sort READY first
  toBeReceived.sort((a, b) => {
    if (a.status === "READY" && b.status !== "READY") return -1;
    if (b.status === "READY" && a.status !== "READY") return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const received = (orders || []).filter((o) => o.status === "COMPLETED");

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">

        {/* Header */}
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Kings Canteen</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">My Orders</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={reload}
              type="button"
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              onClick={() => {
                setNavigatingToMenu(true);
                router.push("/menu");
              }}
              disabled={navigatingToMenu}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {navigatingToMenu ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UtensilsCrossed className="h-3.5 w-3.5" />}
              {navigatingToMenu ? "Loading..." : "Menu"}
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center justify-between gap-2">
              <span>{error}</span>
              <button onClick={reload} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {!loading && (
          <div className="space-y-8">

            {/* ── Section 1: To Be Received ── */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <QrCode className="h-4 w-4 text-amber-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  To Be Received
                </h2>
                {toBeReceived.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                    {toBeReceived.length}
                  </span>
                )}
              </div>

              {toBeReceived.length === 0 ? (
                <EmptyState
                  icon={ShoppingBag}
                  title="No pending pickups"
                  body="Orders you've paid for but haven't collected yet will appear here."
                  cta={
                    <button
                      onClick={() => {
                        setNavigatingToMenu(true);
                        router.push("/menu");
                      }}
                      disabled={navigatingToMenu}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                      {navigatingToMenu ? <Loader2 className="h-4 w-4 animate-spin" /> : <UtensilsCrossed className="h-4 w-4" />}
                      {navigatingToMenu ? "Loading..." : "Browse Menu"}
                    </button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  {toBeReceived.map((order) => (
                    <PendingPickupCard key={order.id} order={order} onReorder={handleReorder} />
                  ))}
                </div>
              )}
            </section>

            {/* ── Section 2: Received / History ── */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Received Orders
                </h2>
                {received.length > 0 && (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {received.length}
                  </span>
                )}
              </div>

              {received.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No received orders yet"
                  body="Orders that have been verified and handed over will appear here."
                />
              ) : (
                <div className="space-y-3">
                  {received.map((order) => (
                    <ReceivedCard key={order.id} order={order} onReorder={handleReorder} />
                  ))}
                </div>
              )}
            </section>

          </div>
        )}
      </div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f6f8fb]" />}>
      <OrdersPageContent />
    </Suspense>
  );
}