"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { useCart } from "@/hooks/useCart";
import { formatNPR } from "@/lib/utils";
import type { MenuItem } from "@/types/menu";

type MenuCardProps = {
  item: MenuItem;
};

export function MenuCard({ item }: MenuCardProps) {
  const { addItem, updateQuantity, items } = useCart();
  const [bump, setBump] = useState(false);
  const [imageError, setImageError] = useState(false);

  const existing = items.find((entry) => entry.id === item.id);
  const quantity = existing?.quantity ?? 0;

  const handleAdd = () => {
    if (!item.isAvailable) return;
    addItem(item, 1);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(10);
    }
    setBump(true);
  };

  useEffect(() => {
    if (!bump) return;
    const timer = setTimeout(() => setBump(false), 200);
    return () => clearTimeout(timer);
  }, [bump]);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-transform ${
        bump ? "scale-[1.02]" : "scale-100"
      }`}
    >
      <div className="relative h-32 w-full overflow-hidden rounded-xl bg-slate-100">
        {!item.imageUrl || imageError ? (
          <div className="flex h-full items-center justify-center text-xs text-neutral-500">
            No image
          </div>
        ) : (
          <Image
            alt={item.name}
            className="object-cover"
            fill
            src={item.imageUrl}
            onError={() => setImageError(true)}
          />
        )}
      </div>
      <div className="mt-3 flex-1">
        <h3 className="text-sm font-semibold text-neutral-900">{item.name}</h3>
        <p className="mt-1 max-h-10 overflow-hidden text-xs text-neutral-600">{item.description}</p>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#0b2447]">{formatNPR(item.price)}</span>
        {quantity > 0 ? (
          <div className="flex items-center gap-2">
            <button
              className="h-8 w-8 rounded-full border border-slate-200 text-sm text-slate-700"
              onClick={() => updateQuantity(item.id, Math.max(1, quantity - 1))}
              type="button"
            >
              -
            </button>
            <span className="text-sm font-semibold">{quantity}</span>
            <button
              className="h-8 w-8 rounded-full border border-slate-200 text-sm text-slate-700"
              onClick={() => updateQuantity(item.id, quantity + 1)}
              type="button"
            >
              +
            </button>
          </div>
        ) : (
            <button
              className="rounded-full bg-[#0b2447] px-4 py-2 text-xs font-semibold text-white"
            onClick={handleAdd}
            type="button"
          >
            Add
          </button>
        )}
      </div>
      {!item.isAvailable ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-white/80 text-sm font-semibold text-slate-600">
          Unavailable
        </div>
      ) : null}
    </div>
  );
}