"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

export function MenuUserActions() {
  const router = useRouter();
  const { user, signOut, isLoading } = useAuth();

  useEffect(() => {
    router.prefetch("/orders");
    router.prefetch("/cart");
    router.prefetch("/checkout");
  }, [router]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/login");
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-500">
        Loading account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/login"
          className="rounded-full bg-[#0b2447] px-4 py-2 text-xs font-semibold text-white"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
        >
          Create account
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div>
        <p className="text-xs font-semibold text-slate-900">{user.name ?? "Account"}</p>
        <p className="text-[11px] text-slate-500">{user.email}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/orders"
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          Order history
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
