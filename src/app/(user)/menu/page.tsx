import Image from "next/image";
import Link from "next/link";
import { Sora } from "next/font/google";

import { CartDrawer } from "@/components/cart/CartDrawer";
import { MenuBrowser } from "@/components/menu/MenuBrowser";
import { MenuUserActions } from "@/components/menu/MenuUserActions";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const sora = Sora({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 150): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
  throw lastError;
}

export default async function Page() {
  const session = await auth();
  let recentOrders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }> = [];
  let orderWarning: string | null = null;

  if (session?.user?.id) {
    try {
      const orders = await withRetry(() =>
        prisma.order.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: "desc" },
          take: 4,
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
        })
      );
      recentOrders = orders.map((order) => ({
        ...order,
        totalAmount: Number(order.totalAmount),
      }));
    } catch (error) {
      console.error("Failed to load recent orders", error);
      orderWarning = "Recent orders are unavailable right now.";
    }
  }

  return (
    <main className={`${sora.className} min-h-screen bg-[#f6f8fb]`}>
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:py-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white">
                <Image
                  alt="Kings Canteen"
                  height={28}
                  src="/image.png"
                  width={28}
                />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#f4a32c]">Kings Canteen</p>
                <h1 className="mt-1 text-2xl font-semibold text-[#0b2447]">Menu</h1>
                <p className="mt-1 text-sm text-slate-500">Fresh items, quick pickup.</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <MenuUserActions />

            </div>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Your recent orders</h2>
              <p className="mt-1 text-sm text-slate-500">Track what you ordered and when.</p>
            </div>
            <Link href="/orders" className="text-xs font-semibold text-[#0b2447]">
              View full history
            </Link>
          </div>
          {orderWarning ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
              {orderWarning}
            </div>
          ) : null}
          {session?.user ? (
            recentOrders.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {recentOrders.map((order) => (
                  <div key={order.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {order.status}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      Ordered: {order.createdAt.toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Rs {order.totalAmount.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                No orders yet. Place your first order from the menu below.
              </div>
            )
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
              Sign in to see your order history.
            </div>
          )}
        </section>

        <div className="mt-6">
          <MenuBrowser />
        </div>

        <CartDrawer />
      </div>
    </main>
  );
}