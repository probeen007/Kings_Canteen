"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { useState } from "react";
import { z } from "zod";
import { AlertCircle } from "lucide-react";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
});

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        portal: "admin",
      });

      if (!result || !result.ok) {
        const message = result?.error || "Invalid credentials or not an admin";
        setErrors({ form: message });
        toast.error(message);
        return;
      }

      const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
      const session = await sessionResponse.json().catch(() => null);
      if (!session?.user || session.user.role !== "ADMIN") {
        setErrors({ form: "Signed in, but admin access was not confirmed." });
        toast.error("Admin access was not confirmed");
        return;
      }

      toast.success("Signed in successfully");
      
      // Refresh to ensure middleware/layouts see the new session
      router.refresh();

      // Delay slightly to let the toast be seen before navigation
      setTimeout(() => {
        router.push("/admin/dashboard");
      }, 1000);
    } catch (err) {
      setErrors({ form: "An error occurred. Please try again." });
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(217,119,6,0.18),_transparent_32%),linear-gradient(135deg,_#0f172a,_#1e293b_55%,_#0f172a)] px-4 py-8 sm:py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-6 text-center sm:mb-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-amber-400 sm:text-xs">Kings Canteen</p>
            <h1 className="mt-2 text-2xl font-bold text-white sm:mt-3 sm:text-3xl">Admin Portal</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">Sign in to manage your canteen</p>
          </div>

          <form className="space-y-4 sm:space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Email Address</label>
              <input
                className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                placeholder="admin@canteen.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.email}
                </p>
              )}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">Password</label>
              <input
                className="w-full rounded-xl border border-slate-600 bg-slate-800/60 px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                type="password"
                autoComplete="current-password"
                maxLength={128}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.password}
                </p>
              )}
            </div>

            {errors.form && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                {errors.form}
              </div>
            )}

            <button
              className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:from-amber-600 hover:to-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-400">
            Demo credentials: admin@canteen.local / Admin123!
          </p>

          <div className="mt-4 text-center">
            <a className="text-xs font-semibold text-slate-300 underline" href="/">
              Back to home
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
