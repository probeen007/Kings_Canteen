"use client";

import { signIn, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { toast } from "react-hot-toast";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password is required"),
});

type FieldErrors = Partial<Record<"email" | "password" | "form", string>>;

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "email" || key === "password") {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const result = await signIn("credentials", {
      redirect: false,
      email: parsed.data.email,
      password: parsed.data.password,
      portal: "user",
    });
    setIsLoading(false);

    if (!result?.ok) {
      const message = result?.error || "Invalid credentials";
      setErrors({ form: message });
      toast.error(message);
      return;
    }

    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store", credentials: "include" });
    const session = await sessionResponse.json().catch(() => null);
    if (!session?.user || session.user.role !== "USER") {
      await signOut({ redirect: false });
      const message = "This account must sign in from the admin portal.";
      setErrors({ form: message });
      toast.error(message);
      return;
    }

    toast.success("Signed in successfully");

    router.replace("/menu");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Welcome back</h1>
        <p className="mt-2 text-sm text-neutral-600">Sign in to continue</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Password</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
          </div>

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

          <button
            className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
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