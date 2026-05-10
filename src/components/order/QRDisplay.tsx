"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface QRDisplayProps {
  qrCode: string;
  orderId: string;
  orderNumber: string;
}

export function QRDisplay({ qrCode, orderId, orderNumber }: QRDisplayProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const link = document.createElement("a");
      link.href = qrCode;
      link.download = `order-${orderNumber}-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg bg-white p-3 shadow-sm">
        {qrCode ? (
          <Image
            src={qrCode}
            alt={`QR Code for order ${orderNumber}`}
            width={200}
            height={200}
            priority
          />
        ) : (
          <div className="flex h-[200px] w-[200px] items-center justify-center rounded bg-gray-200">
            <span className="text-xs text-gray-500">QR code not available</span>
          </div>
        )}
      </div>

      <p className="max-w-[220px] text-center text-xs text-gray-600">
        Show this QR code to staff when picking up your order
      </p>

      <Button
        onClick={handleDownload}
        disabled={isDownloading || !qrCode}
        variant="outline"
        className="w-full sm:w-auto"
      >
        <Download className="mr-2 h-4 w-4" />
        Download QR Code
      </Button>
    </div>
  );
}