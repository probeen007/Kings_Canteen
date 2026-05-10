"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import toast from "react-hot-toast";
import { Loader2, QrCode, Check, X } from "lucide-react";

interface VerifiedOrder {
  id: string;
  orderNumber: string;
  status: string;
  queuePosition: number | null;
  totalAmount: number;
  customer: {
    name: string | null;
    email: string;
  };
  items: Array<{
    menuItem: string;
    quantity: number;
    subtotal: number;
  }>;
}

export default function ScanPage() {
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifiedOrder, setVerifiedOrder] = useState<VerifiedOrder | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token.trim()) {
      toast.error("Please enter a token");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/token/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.message || "Invalid token");
        setVerifiedOrder(null);
      } else {
        setVerifiedOrder(data.order);
        toast.success("Order verified!");
        setToken("");
      }
    } catch (error) {
      toast.error("Failed to verify token");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-2 mb-2">
            <QrCode className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-gray-900">Order Verification</h1>
          </div>
          <p className="text-sm text-gray-600">
            Enter or scan customer's pickup token
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Pickup Token
              </label>
              <Input
                id="token"
                type="text"
                placeholder="Enter token or scan QR code..."
                value={token}
                onChange={(e) => setToken(e.target.value.toUpperCase())}
                disabled={loading}
                className="font-mono text-lg tracking-wider"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-2">
                Tokens are typically displayed as 4-character groups
              </p>
            </div>

            <Button
              type="submit"
              disabled={loading || !token.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-2" />
                  Verify Order
                </>
              )}
            </Button>
          </form>
        </div>

        {/* Verification Result */}
        {verifiedOrder && (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {/* Status Header */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 p-6">
              <div className="flex items-center gap-2 mb-2">
                <Check className="w-6 h-6 text-green-600" />
                <h2 className="text-xl font-bold text-green-900">
                  Order Verified
                </h2>
              </div>
              <p className="text-sm text-green-700">
                Ready to handover order {verifiedOrder.orderNumber}
              </p>
            </div>

            {/* Order Details */}
            <div className="p-6 space-y-6">
              {/* Customer Info */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">
                  Customer
                </h3>
                <div className="space-y-2">
                  <p className="text-lg font-bold text-gray-900">
                    {verifiedOrder.customer.name || "Customer"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {verifiedOrder.customer.email}
                  </p>
                </div>
              </div>

              {/* Order Items */}
              <div className="border-b border-gray-200 pb-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">
                  Items to Prepare/Handover
                </h3>
                <div className="space-y-2">
                  {verifiedOrder.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded"
                    >
                      <span className="font-medium text-gray-900">
                        {item.menuItem}
                      </span>
                      <span className="text-gray-600">× {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Queue Position */}
              {verifiedOrder.queuePosition && (
                <div className="border-b border-gray-200 pb-6">
                  <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">
                    Queue Position
                  </h3>
                  <p className="text-3xl font-bold text-indigo-600">
                    #{verifiedOrder.queuePosition}
                  </p>
                </div>
              )}

              {/* Amount */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">
                  Total Amount
                </h3>
                <p className="text-2xl font-bold text-gray-900">
                  Rs. {(verifiedOrder.totalAmount / 100).toFixed(2)}
                </p>
              </div>

              {/* Action */}
              <Button
                onClick={() => {
                  setVerifiedOrder(null);
                  toast.success("Order handed over!");
                }}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg"
              >
                <Check className="w-4 h-4 mr-2" />
                Mark as Handed Over
              </Button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!verifiedOrder && !loading && (
          <div className="text-center py-12">
            <QrCode className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              Enter or scan a pickup token to verify orders
            </p>
          </div>
        )}
      </div>
    </main>
  );
}