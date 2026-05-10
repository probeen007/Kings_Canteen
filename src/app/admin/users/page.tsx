import Link from "next/link";

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

function WarningState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {message}
    </div>
  );
}

type UsersPageProps = {
  searchParams?: { role?: string } | Promise<{ role?: string }>;
};

const ROLE_FILTERS = [
  { label: "Users", value: "USER" },
  { label: "Staff", value: "STAFF" },
  { label: "Admins", value: "ADMIN" },
  { label: "All", value: "ALL" },
];

export default async function Page({ searchParams }: UsersPageProps) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return <ErrorState title="Access denied" message="You must sign in as an admin to view users." />;
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

    const resolvedSearchParams = await Promise.resolve(searchParams);
    const requestedRole = (resolvedSearchParams?.role || "USER").toUpperCase();
    const roleFilter = ROLE_FILTERS.some((role) => role.value === requestedRole)
      ? requestedRole
      : "USER";

    let users: Array<{
      id: string;
      name: string | null;
      email: string | null;
      role: string;
      isActive: boolean;
      createdAt: Date;
      _count: { orders: number };
    }> = [];
    let dataWarning: string | null = null;

    try {
      users = await withRetry(() =>
        prisma.user.findMany({
          where: roleFilter === "ALL" ? {} : { role: roleFilter as "USER" | "STAFF" | "ADMIN" },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
        })
      );
    } catch (error) {
      console.error("Admin users query failed", error);
      dataWarning = "We couldn't load users right now. Showing an empty list. Please try again soon.";
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <p className="mt-2 text-sm text-slate-600">Monitor active accounts and engagement.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {ROLE_FILTERS.map((filter) => {
            const isActive = roleFilter === filter.value;
            const href = filter.value === "ALL" ? "/admin/users?role=ALL" : `/admin/users?role=${filter.value}`;
            return (
              <Link
                key={filter.value}
                href={href}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[#0b2447] text-white"
                    : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {dataWarning ? <WarningState message={dataWarning} /> : null}
          {users.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              No users available.
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">Orders: {user._count.orders}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                      {user.role}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    return <ErrorState title="Users unavailable" message="We couldn't load the users page right now. Please try again." />;
  }
}
