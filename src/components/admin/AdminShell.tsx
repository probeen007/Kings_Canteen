"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingCart,
  Users,
  TrendingUp,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Scan,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/menu", label: "Menu", icon: UtensilsCrossed },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/verify", label: "Verify Order", icon: Scan },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // If we're on the admin login page, don't render the admin shell (no sidebar/topbar)
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/admin/login");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="flex min-h-screen">
        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-30 w-72 transform bg-white shadow-lg transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Sidebar Header */}
            <div className="border-b border-slate-200 px-6 py-6">
              <button
                onClick={() => setSidebarOpen(false)}
                className="absolute right-4 top-4 rounded-md p-1 lg:hidden"
              >
                <X className="h-5 w-5 text-slate-600" />
              </button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Kings Canteen</p>
                <h1 className="mt-2 text-2xl font-bold text-slate-900">Admin</h1>
                <p className="mt-1 text-sm text-slate-600">Management Panel</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${ active
                      ? "bg-amber-50 text-amber-900 shadow-md"
                      : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User & Logout */}
            <div className="border-t border-slate-200 p-4">
              <div className="mb-4 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-sm font-semibold text-amber-900">
                  {session?.user?.name?.[0]?.toUpperCase() ?? "A"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{session?.user?.name ?? "Admin"}</p>
                  <p className="truncate text-xs text-slate-500">{session?.user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          {/* Top Bar */}
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="text-sm font-medium text-slate-600">
                Welcome back, {session?.user?.name ?? "Admin"}
              </div>
            </div>
          </div>

          {/* Page Content */}
          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
