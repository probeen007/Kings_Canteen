"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Minimum 8 characters")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a special character");

const registerSchema = z
  .object({
    name: z.string().min(2, "Enter your name").max(100).trim(),
    email: z.string().email("Enter a valid email").trim(),
    phone: z.string().regex(/^\+977\d{10}$/, "Use +977XXXXXXXXXX format"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FieldErrors = Partial<
  Record<"name" | "email" | "phone" | "password" | "confirmPassword" | "form", string>
>;

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "w-1/4" };
  if (score === 2) return { label: "Fair", color: "bg-yellow-500", width: "w-2/4" };
  if (score === 3) return { label: "Good", color: "bg-emerald-500", width: "w-3/4" };
  return { label: "Strong", color: "bg-emerald-700", width: "w-full" };
}

export default function Page() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  const handleChange = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});

    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === "string") {
          fieldErrors[key as keyof FieldErrors] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        password: parsed.data.password,
      }),
    });
    setIsLoading(false);

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setErrors({ form: payload?.error ?? "Registration failed" });
      return;
    }

    toast.success("Account created. Please sign in.");
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-10">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-neutral-900">Create your account</h1>
        <p className="mt-2 text-sm text-neutral-600">Join the canteen system</p>

        <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-neutral-700">Full name</label>
              <input
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
                type="text"
                autoComplete="name"
                value={form.name}
                onChange={handleChange("name")}
              />
              {errors.name ? <p className="mt-1 text-xs text-red-600">{errors.name}</p> : null}
            </div>

            <div>
              <label className="text-sm font-medium text-neutral-700">Phone</label>
              <input
                className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
                type="tel"
                placeholder="+977XXXXXXXXXX"
                value={form.phone}
                onChange={handleChange("phone")}
              />
              {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Email</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange("email")}
            />
            {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Password</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={handleChange("password")}
            />
            <div className="mt-2 h-2 w-full rounded-full bg-neutral-200">
              <div className={`h-2 rounded-full ${strength.color} ${strength.width}`} />
            </div>
            <p className="mt-1 text-xs text-neutral-600">Strength: {strength.label}</p>
            {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password}</p> : null}
          </div>

          <div>
            <label className="text-sm font-medium text-neutral-700">Confirm password</label>
            <input
              className="mt-2 w-full rounded-lg border border-neutral-200 px-3 py-2 text-base focus:border-neutral-900 focus:outline-none"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="mt-1 text-xs text-red-600">{errors.confirmPassword}</p>
            ) : null}
          </div>

          {errors.form ? <p className="text-sm text-red-600">{errors.form}</p> : null}

          <button
            className="w-full rounded-lg bg-neutral-900 py-2 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-70"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-600">
          Already have an account?{" "}
          <Link className="font-semibold text-neutral-900 underline" href="/login">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}