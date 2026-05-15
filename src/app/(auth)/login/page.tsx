"use client";

import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password is required"),
});

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

// Retry fetching the session — first login on a new device can have a
// brief window where the Set-Cookie hasn't propagated yet.
async function fetchSessionWithRetry(
  retries = 4,
  delayMs = 400
): Promise<{ user?: { role?: string } } | null> {
  for (let i = 0; i < retries; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, delayMs));
    try {
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (data?.user?.role) return data; // fully populated — done
    } catch { /* network blip — retry */ }
  }
  return null;
}

type Phase = "idle" | "signing-in" | "verifying" | "redirecting";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>("idle");

  const isLoading = phase !== "idle";

  useEffect(() => {
    router.prefetch("/menu");
    router.prefetch("/orders");
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    // ── Phase 1: authenticate ──────────────────────────────────────────────
    setPhase("signing-in");
    const result = await signIn("credentials", {
      redirect: false,
      email: parsed.data.email,
      password: parsed.data.password,
      portal: "user",
    });

    if (!result?.ok) {
      setPhase("idle");
      const message = result?.error || "Invalid credentials";
      setErrors({ form: message });
      toast.error(message);
      return;
    }

    // ── Phase 2: verify session (with retry for new-device cookie race) ───
    setPhase("verifying");
    const session = await fetchSessionWithRetry();

    if (!session?.user || session.user.role !== "USER") {
      await signOut({ redirect: false });
      setPhase("idle");
      const message = "This account must sign in from the admin portal.";
      setErrors({ form: message });
      toast.error(message);
      return;
    }

    // ── Phase 3: warm caches then navigate ────────────────────────────────
    setPhase("redirecting");
    toast.success("Signed in! Taking you to the menu…");

    // Fire-and-forget prefetch warm-up
    Promise.allSettled([
      fetch("/api/menu?summary=1", { cache: "no-store" }),
      fetch("/api/orders", { cache: "no-store", credentials: "include" }),
    ]).catch(() => null);

    router.replace("/menu");
  };

  // Phase labels shown inside the button
  const buttonLabel: Record<Phase, string> = {
    idle: "Sign in",
    "signing-in": "Signing in…",
    verifying: "Verifying account…",
    redirecting: "Opening menu…",
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      {/* Full-page overlay while redirecting — prevents double-submit and shows progress */}
      {phase === "redirecting" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-white/90 backdrop-blur-sm">
          <Loader2 className="h-10 w-10 animate-spin text-neutral-800" />
          <p className="text-sm font-medium text-neutral-700">Opening your menu…</p>
        </div>
      )}

      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Welcome back</h1>
        <p className="mt-2 text-sm text-neutral-600">Sign in to continue</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:opacity-60"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Password</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none disabled:opacity-60"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
          </div>

          {errors.form && <p className="text-sm text-red-600">{errors.form}</p>}

          <button
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-900 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {buttonLabel[phase]}
          </button>

          {/* Progress indicator under the button during verification */}
          {(phase === "signing-in" || phase === "verifying") && (
            <div className="space-y-1.5">
              <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
                <div
                  className="h-full rounded-full bg-neutral-900 transition-all duration-500"
                  style={{ width: phase === "signing-in" ? "40%" : "80%" }}
                />
              </div>
              <p className="text-center text-xs text-neutral-400">
                {phase === "signing-in" ? "Checking credentials…" : "Loading your account…"}
              </p>
            </div>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          New here?{" "}
          <Link className="font-semibold text-neutral-900 underline" href="/register">
            Create an account
          </Link>
        </p>

        <div className="mt-4 text-center">
          <Link className="text-sm font-semibold text-neutral-700 underline" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}