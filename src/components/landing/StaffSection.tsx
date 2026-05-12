import Link from "next/link";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";

export function StaffSection() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4">
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 via-blue-500 to-orange-500 p-12 text-white shadow-lg md:p-16">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="mb-4 flex items-center gap-3">
                <Users className="h-8 w-8" />
                <h3 className="text-2xl font-bold">For Our Staff</h3>
              </div>
              <p className="mb-8 text-lg opacity-90">
                Streamline your operations with our intelligent queue management system.
              </p>
              <ul className="space-y-3">
                {[
                  "Real-time order queue",
                  "QR code scanning",
                  "Order status tracking",
                  "Menu management",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-white" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-white/10 p-8 backdrop-blur-sm">
              <p className="mb-6 text-sm opacity-90">Staff Login</p>
              <Link href="/staff/login">
                <Button size="lg" className="w-full bg-white font-semibold text-blue-600 hover:bg-gray-100">
                  Staff Portal
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
