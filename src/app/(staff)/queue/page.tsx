"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { Button } from "@/components/ui/button";
import { formatDate, formatPrice } from "@/lib/utils";
import { Clock, Users, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

interface OrderForQueue {
  id: string;
  orderNumber: string;
  queuePosition: number | null;
  status: string;
  pickupTime: string;
  totalAmount: number;
  user: {
    name: string | null;
    email: string;
  };
  items: Array<{
    menuItem: {
      name: string;
    };
    quantity: number;
  }>;
}

export default function QueuePage() {
  const { data: session, status } = useSession();
  const [orders, setOrders] = useState<OrderForQueue[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingReady, setMarkingReady] = useState<string | null>(null);
  const { connected, on, off } = useSocket({
    userId: session?.user?.id,
    role: session?.user?.role,
  });

  // Fetch initial orders
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch("/api/orders?status=CONFIRMED,PREPARING");
        const data = await response.json();
        if (data.data) {
          setOrders(data.data);
        }
      } catch (error) {
        toast.error("Failed to fetch orders");
      } finally {
        setLoading(false);
      }
    };

    if (status === "authenticated") {
      fetchOrders();
    }
  }, [status]);

  // Listen for new orders
  useEffect(() => {
    const handleNewOrder = (event: any) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === event.orderId);
        if (!exists) {
          return [
            ...prev,
            {
              id: event.orderId,
              orderNumber: event.orderNumber,
              queuePosition: event.queuePosition,
              status: "CONFIRMED",
              pickupTime: event.pickupTime,
              totalAmount: event.totalAmount,
              user: {
                name: event.userName,
                email: "customer@canteen.local",
              },
              items: event.items.map((item: any) => ({
                menuItem: { name: item.name },
                quantity: item.quantity,
              })),
            },
          ];
        }
        return prev;
      });
      toast.success("New order received!");
    };

    const handleOrderReady = (event: any) => {
      setOrders((prev) => 
        prev.filter((o) => o.id !== event.orderId)
      );
      toast.success(`Order ${event.orderNumber} marked as ready`);
    };

    on("order:new", handleNewOrder);
    on("order:ready", handleOrderReady);

    return () => {
      off("order:new", handleNewOrder);
      off("order:ready", handleOrderReady);
    };
  }, [on, off]);

  const handleMarkReady = async (orderId: string) => {
    setMarkingReady(orderId);
    try {
      const response = await fetch(`/api/orders/${orderId}/ready`, {
        method: "PATCH",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to mark order as ready");
      }

      // Remove from list
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success("Order marked as ready!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark order as ready");
    } finally {
      setMarkingReady(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Queue Management</h1>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-sm text-gray-600">
              {orders.length} order{orders.length !== 1 ? "s" : ""} pending
            </p>
            <div
              className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                connected
                  ? "bg-green-100 text-green-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${connected ? "bg-green-600" : "bg-amber-600"}`}
              />
              {connected ? "Live" : "Offline"}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No pending orders</p>
            <p className="text-gray-500 text-sm mt-2">
              Orders will appear here when customers place them
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders
              .sort((a, b) => {
                // Sort by pickup time, then by queue position
                const timeA = new Date(a.pickupTime).getTime();
                const timeB = new Date(b.pickupTime).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
              })
              .map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-lg shadow-md p-6 border-l-4 border-indigo-500 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">
                        {order.orderNumber}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {order.user.name || "Customer"} • {order.user.email}
                      </p>
                    </div>
                    <div className="text-right">
                      {order.queuePosition && (
                        <div className="inline-flex items-center gap-1 bg-blue-100 px-3 py-1 rounded-full">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="font-bold text-blue-600">
                            #{order.queuePosition}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-sm">
                        {formatDate(new Date(order.pickupTime))}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-indigo-600">
                        {formatPrice(order.totalAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <p className="text-xs font-semibold text-gray-600 mb-2 uppercase">
                      Items
                    </p>
                    <ul className="space-y-1">
                      {order.items.map((item, idx) => (
                        <li key={idx} className="text-sm text-gray-700">
                          <span className="font-medium">{item.menuItem.name}</span>
                          {" "}
                          <span className="text-gray-500">× {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Status badge */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                        order.status === "PREPARING"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <div
                        className={`h-2 w-2 rounded-full ${
                          order.status === "PREPARING"
                            ? "bg-amber-600"
                            : "bg-blue-600"
                        }`}
                      />
                      {order.status === "PREPARING" ? "Preparing" : "Confirmed"}
                    </div>

                    <Button
                      onClick={() => handleMarkReady(order.id)}
                      disabled={markingReady === order.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {markingReady === order.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Marking...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Mark as Ready
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </main>
  );
}