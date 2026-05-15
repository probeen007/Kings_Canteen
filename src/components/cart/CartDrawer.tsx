"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { useCart } from "@/hooks/useCart";

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { items, totalItems, totalAmount, updateQuantity, removeItem, hydrated } = useCart();
  const router = useRouter();

  if (!hydrated) {
    return null;
  }

  return (
    <>
      <button
        className="fixed bottom-6 right-6 z-30 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
        onClick={() => setOpen(true)}
        type="button"
      >
        Cart ({totalItems})
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
      ) : null}
      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-sm transform bg-white p-6 shadow-2xl transition-transform ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-700">Your cart</h2>
          <button className="text-sm text-slate-400" onClick={() => setOpen(false)} type="button">
            Close
          </button>
        </div>
        <div className="mt-6 space-y-4">
          {items.length ? (
            items.map((item) => (
              <CartItem
                key={item.id}
                item={item}
                onIncrease={() => updateQuantity(item.id, item.quantity + 1)}
                onDecrease={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                onRemove={() => removeItem(item.id)}
              />
            ))
          ) : (
            <p className="text-sm text-slate-400">Your cart is empty.</p>
          )}
        </div>
        <CartSummary
          totalItems={totalItems}
          totalAmount={totalAmount}
          disabled={items.length === 0}
          onCheckout={() => {
            if (items.length === 0) return;
            setOpen(false);
            router.push("/checkout");
          }}
        />
      </aside>
    </>
  );
}