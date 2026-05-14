"use client";

import { addDays, addMinutes, format, isAfter, isBefore, setHours, setMinutes } from "date-fns";
import { useRouter } from "next/navigation";
import { Sora } from "next/font/google";
import { useEffect, useMemo, useState } from "react";

import { useCart } from "@/hooks/useCart";
import { formatNPR } from "@/lib/utils";
import { clientCache } from "@/lib/clientCache";

type OrderResponse = {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  queuePosition: number | null;
};

const OPERATING_START = 7;
const OPERATING_END = 21;
const ASAP_TOKEN = "ASAP";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

function generateSlots(date: Date) {
  const start = setMinutes(setHours(date, OPERATING_START), 0);
  const end = setMinutes(setHours(date, OPERATING_END), 0);
  const slots: Date[] = [];
  let cursor = start;
  while (isBefore(cursor, end) || cursor.getTime() === end.getTime()) {
    slots.push(cursor);
    cursor = addMinutes(cursor, 30);
  }
  return slots;
}

export default function Page() {
  const router = useRouter();
  const { items, totalAmount, totalItems, clearCart } = useCart();
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [pickupMode, setPickupMode] = useState<"ASAP" | "SCHEDULED">("SCHEDULED");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nextDays = useMemo(() => {
    return Array.from({ length: 4 }, (_, index) => addDays(new Date(), index));
  }, []);

  const slots = useMemo(() => generateSlots(selectedDate), [selectedDate]);

  useEffect(() => {
    router.prefetch("/orders");
    router.prefetch("/menu");
  }, [router]);

  const handleSubmit = async () => {
    setError(null);
    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }
    if (pickupMode === "SCHEDULED" && (!selectedTime || !isAfter(selectedTime, new Date()))) {
      setError("Select a valid pickup time.");
      return;
    }

    setLoading(true);
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        pickupTime: pickupMode === "ASAP" ? ASAP_TOKEN : selectedTime!.toISOString(),
        notes: notes.trim() ? notes : undefined,
      }),
    });
    setLoading(false);

    if (!response.ok) {
      setError("Failed to create order.");
      return;
    }

    const payload = (await response.json()) as { data?: OrderResponse };
    if (!payload.data) {
      setError("Order creation failed.");
      return;
    }

    const paymentResponse = await fetch("/api/payment/initiate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: payload.data.orderId }),
    });

    if (!paymentResponse.ok) {
      setError("Failed to initiate payment.");
      return;
    }

    const paymentPayload = (await paymentResponse.json()) as {
      data?: { paymentUrl: string; fields: Record<string, string> };
    };

    if (!paymentPayload.data) {
      setError("Payment initialization failed.");
      return;
    }

    clientCache.invalidate("orders:list");
    clearCart();

    const form = document.createElement("form");
    form.method = "POST";
    form.action = paymentPayload.data.paymentUrl;

    Object.entries(paymentPayload.data.fields).forEach(([key, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = key;
      input.value = value;
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();
  };

  return (
    <main className={`${sora.className} min-h-screen bg-[#f6f8fb]`}>
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-8">
        <div className="mb-6 flex items-center justify-between">
          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            onClick={() => router.back()}
            type="button"
          >
            Back
          </button>
          <h1 className="text-xl font-semibold text-slate-800 sm:text-2xl">Checkout</h1>
          <div className="w-[76px]" />
        </div>

        <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">Pickup time</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className={`rounded-full px-4 py-2 text-sm ${
                pickupMode === "ASAP" ? "bg-[#0b2447] text-white" : "bg-slate-100 text-slate-600"
              }`}
              onClick={() => {
                setPickupMode("ASAP");
                setSelectedTime(null);
              }}
              type="button"
            >
              ASAP
            </button>
            {nextDays.map((date) => {
              const isActive = format(date, "yyyy-MM-dd") === format(selectedDate, "yyyy-MM-dd");
              return (
                <button
                  key={date.toISOString()}
                  className={`rounded-full px-4 py-2 text-sm ${
                    isActive ? "bg-[#0b2447] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                  onClick={() => {
                    setSelectedDate(date);
                    setSelectedTime(null);
                    setPickupMode("SCHEDULED");
                  }}
                  type="button"
                >
                  {format(date, "EEE dd MMM")}
                </button>
              );
            })}
          </div>

          <div
            className={`mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4 ${
              pickupMode === "ASAP" ? "opacity-50 pointer-events-none" : ""
            }`}
          >
            {slots.map((slot) => {
              const disabled = isBefore(slot, new Date());
              const active = selectedTime?.getTime() === slot.getTime();
              return (
                <button
                  key={slot.toISOString()}
                  className={`rounded-lg px-3 py-2 text-xs ${
                    active ? "bg-[#0b2447] text-white" : "bg-slate-100 text-slate-700"
                  } ${disabled ? "opacity-40" : ""}`}
                  disabled={disabled}
                  onClick={() => {
                    setPickupMode("SCHEDULED");
                    setSelectedTime(slot);
                  }}
                  type="button"
                >
                  {format(slot, "hh:mm a")}
                </button>
              );
            })}
          </div>

          {pickupMode === "ASAP" ? (
            <p className="mt-3 text-xs text-slate-500">ASAP selected. No time selection needed.</p>
          ) : null}

          <div className="mt-6">
            <label className="text-sm font-medium text-slate-700">Notes (optional)</label>
            <textarea
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
          </section>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-semibold text-slate-800">Order summary</h2>
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              {items.length ? (
                items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span>
                      {item.name} x{item.quantity}
                    </span>
                    <span>{formatNPR(item.price * item.quantity)}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">Your cart is empty.</p>
              )}
            </div>
            <div className="mt-4 flex items-center justify-between text-sm font-semibold text-slate-700">
              <span>Total ({totalItems} items)</span>
              <span>{formatNPR(totalAmount)}</span>
            </div>
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            <button
              className="mt-4 w-full rounded-lg bg-[#0b2447] py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              onClick={handleSubmit}
              type="button"
              disabled={loading}
            >
              {loading ? "Creating order..." : "Pay with eSewa"}
            </button>
          </aside>
        </div>
      </div>
    </main>
  );
}

