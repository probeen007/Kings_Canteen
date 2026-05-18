import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const metadata: Metadata = {
  title: "Settings",
};

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
      return <ErrorState title="Access denied" message="You must sign in as an admin to view settings." />;
    }

    const checkDb = async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return "Connected";
      } catch {
        return "Unavailable";
      }
    };

    const checkRedis = async () => {
      try {
        const key = `health:${Date.now()}`;
        await redis.set(key, "ok", { ex: 10 });
        const val = (await redis.get(key)) as string | null;
        return val === "ok" ? "Active" : "Unavailable";
      } catch {
        return "Unavailable";
      }
    };

    const [dbStatus, redisStatus] = await Promise.all([checkDb(), checkRedis()]);

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="mt-2 text-sm text-slate-600">System settings and operational health.</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">System Status</h2>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Database</span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${dbStatus === "Connected" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                {dbStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Redis Cache</span>
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${redisStatus === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"}`}>
                {redisStatus}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">API Service</span>
              <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">Running</span>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Settings unavailable" message="We couldn't load the settings page right now. Please try again." />;
  }
}
