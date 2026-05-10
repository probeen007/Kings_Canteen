"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "react-hot-toast";

interface OrderTokenProps {
  token: string;
  orderNumber: string;
}

export function OrderToken({ token, orderNumber }: OrderTokenProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    toast.success("Token copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Format token in groups for readability
  const formattedToken = token
    .toUpperCase()
    .match(/.{1,4}/g)
    ?.join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg border border-indigo-200 bg-gradient-to-br from-blue-50 to-indigo-50 px-3 py-2.5 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-600">
          Pickup Token
        </p>
        <p className="mt-1.5 text-base font-mono font-bold text-indigo-900 tracking-wider break-all">
          {formattedToken}
        </p>
        <p className="mt-1 text-[10px] text-gray-600">Order: {orderNumber}</p>
      </div>

      <p className="max-w-[220px] text-center text-xs text-gray-600">
        Tell this token number to staff or show the QR code.
      </p>

      <Button
        onClick={handleCopy}
        variant="outline"
        className="w-full sm:w-auto"
      >
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4" />
            Copied
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copy Token
          </>
        )}
      </Button>
    </div>
  );
}