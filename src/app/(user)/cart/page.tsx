"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { useCart } from "@/hooks/useCart";

export default function Page() {
  const router = useRouter();
  const { items, totalItems, totalAmount, updateQuantity, removeItem, hydrated } = useCart();

  useEffect(() => {
    router.prefetch("/menu");
    router.prefetch("/checkout");
  }, [router]);

  if (!hydrated) {
    return (
      <main className="min-h-screen bg-[#f6f8fb]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-500">Loading your cart...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Kings Canteen</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Your Cart</h1>
          </div>
          <Link
            href="/menu"
            className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition-colors"
          >
            Add Items
          </Link>
        </header>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
              <p className="text-sm font-semibold text-slate-700">Your cart is empty</p>
              <p className="mt-1 text-xs text-slate-400">Browse the menu to add items.</p>
              <Link
                href="/menu"
                className="mt-4 inline-flex rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
              >
                Go to Menu
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
                  onDecrease={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}

          <div className="mt-6">
            <CartSummary
              totalItems={totalItems}
              totalAmount={totalAmount}
              onCheckout={() => {
                if (items.length > 0) {
                  window.location.href = "/checkout";
                }
              }}
              disabled={items.length === 0}
            />
          </div>
        </div>
      </div>
    </main>
  );
}