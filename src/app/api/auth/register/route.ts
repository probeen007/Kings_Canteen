import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const passwordSchema = z
  .string()
  .min(8)
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/\d/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

const registerSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().trim(),
  phone: z.string().regex(/^\+977\d{10}$/, "Phone must be in +977XXXXXXXXXX format"),
  password: passwordSchema,
});

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  let limit: { allowed: boolean; resetAt: number } | null = null;
  try {
    limit = await rateLimit(`rate:auth:register:${ip}`, 5, 60 * 60);
  } catch (err) {
    // Fall back to a simple in-memory limiter when Redis is unavailable.
    console.error("rateLimit error:", err);
    const now = Date.now();
    const windowMs = 60 * 60 * 1000;
    const key = `register:${ip}`;
    (globalThis as any).__registerRateLimit ??= new Map<string, { count: number; resetAt: number }>();
    const store = (globalThis as any).__registerRateLimit as Map<string, { count: number; resetAt: number }>;
    const existing = store.get(key);
    if (!existing || existing.resetAt <= now) {
      const resetAt = now + windowMs;
      store.set(key, { count: 1, resetAt });
      limit = { allowed: true, resetAt };
    } else {
      existing.count += 1;
      limit = { allowed: existing.count <= 5, resetAt: existing.resetAt };
    }
  }

  if (limit && !limit.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many requests", code: "RATE_001" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((limit.resetAt - Date.now()) / 1000)) } }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Validation error", code: "VALIDATION", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const email = parsed.data.email.toLowerCase();
  const phone = parsed.data.phone;

  try {
    const [existingEmail, existingPhone] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      prisma.user.findUnique({ where: { phone } }),
    ]);

    if (existingEmail || existingPhone) {
      return NextResponse.json(
        { success: false, error: "User already exists", code: "CONFLICT" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);

    const user = await prisma.user.create({
      data: {
        name: parsed.data.name,
        email,
        phone,
        passwordHash,
        role: "USER",
      },
    });

    // audit log is optional — don't fail the registration if it errors
    try {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "USER_REGISTERED",
          ipAddress: ip,
        },
      });
    } catch (auditErr) {
      console.error("audit log failed:", auditErr);
    }

    return NextResponse.json({ success: true, data: { id: user.id } }, { status: 201 });
  } catch (err) {
    console.error("registration error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
