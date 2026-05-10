import { format } from "date-fns";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-red-900">{title}</h1>
      <p className="mt-2 text-sm text-red-700">{message}</p>
    </div>
  );
}

export default async function Page() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return <ErrorState title="Access denied" message="You must sign in as an admin to view orders." />;
    }

    const withRetry = async <T,>(fn: () => Promise<T>, attempts = 2) => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= attempts; attempt += 1) {
        try {
          return await fn();
        } catch (error) {
          lastError = error;
          if (attempt < attempts) {
            await new Promise((resolve) => setTimeout(resolve, 150));
          }
        }
      }
      throw lastError;
    };

    const orders = await withRetry(() =>
      prisma.order.findMany({
        where: {
          status: {
            notIn: ["PENDING", "CANCELLED"]
          }
        },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      })
    );

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="mt-2 text-sm text-slate-600">Track recent orders and status updates.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No orders yet.
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{order.orderNumber}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order.user?.name ?? "Unknown"} · {order.user?.email ?? ""}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {order._count.items} items · Pickup {format(order.pickupTime, "hh:mm a, MMM d")}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {order.status}
                    </span>
                    <span className="text-sm font-semibold text-slate-900">Rs. {Number(order.totalAmount).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Orders unavailable" message="We couldn't load the orders page right now. Please try again." />;
  }
}
