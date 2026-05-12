import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OrderToken } from "@/components/order/OrderToken";
import { QRDisplay } from "@/components/order/QRDisplay";
import { TokenStatusPoller } from "@/components/order/TokenStatusPoller";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft, Clock, Users, CheckCircle2 } from "lucide-react";
import { generateQRCode } from "@/lib/qr";
import { formatNPR } from "@/lib/utils";

export default async function TokenPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const session = await auth();

  if (!session?.user) {
    return notFound();
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          menuItem: true,
        },
      },
    },
  });

  if (!order || order.userId !== session.user.id) {
    return notFound();
  }

  // Order was already claimed — send user to order history
  if (order.status === "COMPLETED") {
    redirect("/orders?claimed=1");
  }

  // Order cancelled or never paid — send to order history
  if (order.status === "CANCELLED" || !order.token) {
    redirect("/orders");
  }

  let qrCodeValue = order.qrData ?? "";
  if (!qrCodeValue.startsWith("data:image")) {
    try {
      qrCodeValue = await generateQRCode(order.token);
    } catch (error) {
      console.error("QR generation failed", error);
      qrCodeValue = "";
    }
  }

  const pickupTime = new Date(order.pickupTime);
  const now = new Date();
  const isExpired = pickupTime.getTime() < now.getTime();

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      {/* Silent status poller — redirects to /orders when order is COMPLETED */}
      <TokenStatusPoller orderId={order.id} />
      <div className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/orders" className="inline-flex">
            <Button size="sm" className="bg-[#0b2447] text-white hover:bg-[#0b2447]/90">
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back to Orders
            </Button>
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">Pickup Token</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 py-5 sm:py-7">
        {isExpired && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
            <p className="font-semibold">Pickup time has passed</p>
            <p className="mt-1 text-sm">Please contact staff if you still need to pick up your order.</p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-500">Kings Canteen</p>
              <h2 className="mt-2 text-xl font-semibold text-slate-900">Order Receipt</h2>
              <p className="mt-1 text-sm text-slate-500">#{order.orderNumber}</p>
            </div>
            <div className="flex flex-col items-start gap-2 text-sm text-slate-600">
              <div className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 text-slate-500" />
                <span>
                  Pickup {order.isAsap
                    ? "ASAP"
                    : pickupTime.toLocaleString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                </span>
              </div>
              {order.queuePosition ? (
                <div className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 text-slate-500" />
                  <span>Position #{order.queuePosition}</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[260px,1fr]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="grid gap-3 sm:grid-cols-2 sm:items-start lg:grid-cols-1">
                <div>
                  <h3 className="text-xs font-semibold text-slate-700">QR Code</h3>
                  <div className="mt-2">
                    <QRDisplay qrCode={qrCodeValue} orderId={order.id} orderNumber={order.orderNumber} />
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-700">Pickup Number</h3>
                  <div className="mt-2">
                    <OrderToken token={order.token} orderNumber={order.orderNumber} />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">
                  <span>Items</span>
                  <span>Amount</span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <span className="text-slate-700">
                        {item.menuItem.name} × {item.quantity}
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatNPR(item.subtotal)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-lg font-bold text-slate-900">
                    {formatNPR(order.totalAmount)}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                <p className="font-semibold">Pickup instructions</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-blue-800">
                  <li>Come to the counter at your scheduled pickup time.</li>
                  <li>Show the QR code or tell staff your pickup number.</li>
                  <li>Staff will verify and hand over your order.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}