"use client";

import { useState } from "react";

import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { formatNPR } from "@/lib/utils";
import type { Order } from "@/types/order";

type OrderCardProps = {
  order: Order;
  onReorder: (order: Order) => void;
};

export function OrderCard({ order, onReorder }: OrderCardProps) {
  const [open, setOpen] = useState(false);
  const paymentLabel = order.paymentStatus.replace("_", " ");
  const paymentStyle =
    order.paymentStatus === "SUCCESS"
      ? "bg-emerald-100 text-emerald-700"
      : order.paymentStatus === "FAILED"
        ? "bg-red-100 text-red-700"
        : order.paymentStatus === "REFUNDED"
          ? "bg-slate-200 text-slate-700"
          : "bg-amber-100 text-amber-700";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
          <p className="mt-1 text-xs text-slate-500">
            Ordered {new Date(order.createdAt).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Pickup {new Date(order.pickupTime).toLocaleString()}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {order.items.length} items
          </span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStyle}`}>
            {paymentLabel}
          </span>
        </div>
        <p className="text-sm font-semibold text-slate-900">{formatNPR(order.totalAmount)}</p>
      </div>

      <button
        className="mt-3 text-xs font-semibold text-slate-600"
        onClick={() => setOpen((prev) => !prev)}
        type="button"
      >
        {open ? "Hide details" : "View details"}
      </button>

      {open ? (
        <div className="mt-3 space-y-2 text-sm text-slate-600">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between">
              <span>
                {item.name} x{item.quantity}
              </span>
              <span className="text-slate-700">{formatNPR(item.subtotal)}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
        <button
          className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700"
          onClick={() => onReorder(order)}
          type="button"
        >
          Re-order
        </button>
      </div>
    </div>
  );
}