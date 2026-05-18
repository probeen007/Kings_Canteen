import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BarChart, Users, ShoppingCart, TrendingUp } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin Dashboard",
};

const STATS_CACHE_KEY = "admin:stats:today:v1";
const STATS_CACHE_TTL = 30;

async function withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 150): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= attempts; attempt++) {
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

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-red-900">{title}</h1>
      <p className="mt-2 text-sm text-red-700">{message}</p>
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
}

function StatCard({ icon, label, value, change }: StatCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          {change && <p className="mt-1 text-sm text-green-600">{change}</p>}
        </div>
        <div className="rounded-lg bg-amber-50 p-3 text-amber-600">{icon}</div>
      </div>
    </div>
  );
}

export default async function AdminDashboard() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return <ErrorState title="Access denied" message="You must sign in as an admin to view the dashboard." />;
    }

    const cached = (await redis.get(STATS_CACHE_KEY).catch(() => null)) as
      | { ordersCount: number; revenue: number; activeUsers: number }
      | null;

    const now = Date.now();
    const since = new Date(now - 24 * 60 * 60 * 1000);

    const [ordersCountResult, totalRevenueResult, activeUsersResult] = cached
      ? [
          { status: "fulfilled" as const, value: cached.ordersCount },
          { status: "fulfilled" as const, value: { _sum: { amount: cached.revenue } } },
          { status: "fulfilled" as const, value: cached.activeUsers },
        ]
      : await Promise.allSettled([
          withRetry(() => prisma.order.count({ where: { createdAt: { gte: since } } })),
          withRetry(() =>
            prisma.payment.aggregate({
              _sum: { amount: true },
              where: { status: "SUCCESS", initiatedAt: { gte: since } },
            })
          ),
          withRetry(() => prisma.user.count({ where: { role: "USER", isActive: true } })),
        ]);

    const ordersCount = ordersCountResult.status === "fulfilled" ? ordersCountResult.value : 0;
    const totalRevenue = totalRevenueResult.status === "fulfilled" ? totalRevenueResult.value : null;
    const activeUsers = activeUsersResult.status === "fulfilled" ? activeUsersResult.value : 0;

    const revenue = totalRevenue?._sum.amount ? Number(totalRevenue._sum.amount) : 0;

    if (!cached && ordersCountResult.status === "fulfilled" && totalRevenueResult.status === "fulfilled" && activeUsersResult.status === "fulfilled") {
      await redis
        .set(
          STATS_CACHE_KEY,
          { ordersCount, revenue, activeUsers },
          { ex: STATS_CACHE_TTL }
        )
        .catch(() => null);
    }
    const statsWarning =
      ordersCountResult.status === "rejected" || totalRevenueResult.status === "rejected" || activeUsersResult.status === "rejected"
        ? "Some dashboard stats could not be loaded, so a few values may be unavailable."
        : null;

    return (
      <div className="space-y-8">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-slate-600">Welcome back, {session?.user?.name}. Here's what's happening today.</p>
          {statsWarning ? <p className="mt-2 text-sm text-amber-700">{statsWarning}</p> : null}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<ShoppingCart className="h-6 w-6" />}
            label="Today's Orders"
            value={ordersCount.toString()}
            change="+2 from yesterday"
          />
          <StatCard
            icon={<TrendingUp className="h-6 w-6" />}
            label="Today's Revenue"
            value={`Rs. ${revenue.toLocaleString()}`}
            change="+12% from yesterday"
          />
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="Active Users"
            value={activeUsers.toString()}
            change="+5 this week"
          />
          <StatCard
            icon={<BarChart className="h-6 w-6" />}
            label="Pending Orders"
            value="3"
            change="Update in 2m"
          />
        </div>

        {/* Quick Actions */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-4 space-y-3">
              <a
                href="/admin/menu"
                className="block rounded-lg bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 transition-colors"
              >
                Manage Menu Items
              </a>
              <a
                href="/admin/orders"
                className="block rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-900 hover:bg-blue-100 transition-colors"
              >
                View Orders
              </a>
              <a
                href="/admin/users"
                className="block rounded-lg bg-green-50 px-4 py-2 text-sm font-medium text-green-900 hover:bg-green-100 transition-colors"
              >
                Manage Users
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Dashboard unavailable" message="We couldn't load dashboard stats right now. Please try again." />;
  }
}
