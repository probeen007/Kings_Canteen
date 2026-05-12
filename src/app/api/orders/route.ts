import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@prisma/client";
import { getQueuePosition } from "@/lib/redis";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimiter";
import { calculateTotal, generateOrderNumber, sanitizeInput } from "@/lib/utils";
import { createOrderSchema } from "@/schemas/orderSchema";
import { generateOrderToken } from "@/lib/token";
import { generateQRCode, generateQRString } from "@/lib/qr";

const listSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
});

const ASAP_TOKEN = "ASAP";
const ASAP_PREP_MINUTES = 15;
const OPERATING_START = 7;
const OPERATING_END = 21;
const SLOT_MINUTES = 10;

function roundUpToMinutes(value: Date, minutes: number) {
  const intervalMs = minutes * 60 * 1000;
  return new Date(Math.ceil(value.getTime() / intervalMs) * intervalMs);
}

function getAsapPickupTime(now = new Date()) {
  const start = new Date(now);
  start.setHours(OPERATING_START, 0, 0, 0);
  const end = new Date(now);
  end.setHours(OPERATING_END, 0, 0, 0);

  if (now.getTime() < start.getTime()) return start;

  let candidate = new Date(now.getTime() + ASAP_PREP_MINUTES * 60 * 1000);
  candidate = roundUpToMinutes(candidate, SLOT_MINUTES);

  if (candidate.getTime() > end.getTime()) {
    const nextDay = new Date(now);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(OPERATING_START, 0, 0, 0);
    return nextDay;
  }

  return candidate;
}

const ALLOWED_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
]);

function validatePickupTime(value: string) {
  if (value === ASAP_TOKEN) {
    return getAsapPickupTime();
  }

  const pickupTime = new Date(value);
  if (Number.isNaN(pickupTime.getTime())) {
    throw new AppError("Pickup time invalid", 400, "ORDER_003");
  }
  const now = new Date();
  if (pickupTime.getTime() <= now.getTime()) {
    throw new AppError("Pickup time invalid", 400, "ORDER_003");
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 3);
  if (pickupTime.getTime() > maxDate.getTime()) {
    throw new AppError("Pickup time invalid", 400, "ORDER_003");
  }

  const hours = pickupTime.getHours();
  if (hours < 7 || hours > 21 || (hours === 21 && pickupTime.getMinutes() > 0)) {
    throw new AppError("Pickup time invalid", 400, "ORDER_003");
  }

  return pickupTime;
}

export const POST = apiHandler(
  async (_request, context) => {
    if (!context.user) {
      throw new AuthError("Unauthenticated", "AUTH_001");
    }

    const body = context.body ?? createOrderSchema.parse({});
    const isAsap = body.pickupTime === ASAP_TOKEN;
    const pickupTime = validatePickupTime(body.pickupTime);

    const limit = await enforceRateLimit(
      `rate:order:create:${context.user.id}`,
      RATE_LIMITS.orderCreate.maxRequests,
      RATE_LIMITS.orderCreate.windowSeconds
    );
    if (!limit.allowed) {
      throw new AppError("Too many requests", 429, "RATE_001", {
        retryAfterSeconds: Math.ceil((limit.resetAt - Date.now()) / 1000),
      });
    }

    const menuItemIds = body.items.map((item) => item.menuItemId);
    const menuItems = await prisma.menuItem.findMany({
      where: {
        id: { in: menuItemIds },
        isAvailable: true,
      },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new AppError("Item not available", 422, "ORDER_001");
    }

    const total = calculateTotal(
      body.items.map((item) => {
        const menuItem = menuItems.find((entry) => entry.id === item.menuItemId);
        return { quantity: item.quantity, unitPrice: menuItem?.price ?? 0 };
      })
    );

    const orderNumber = await generateOrderNumber();
    const pickupSlot = pickupTime.toISOString().slice(0, 16);
    let queuePosition: number | null = null;
    try {
      queuePosition = await getQueuePosition(pickupSlot);
    } catch {
      const count = await prisma.order.count({ where: { pickupTime } });
      queuePosition = count + 1;
    }

    const notes = body.notes ? sanitizeInput(body.notes) : null;

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: context.user!.id,
          totalAmount: total.toNumber(),
          pickupTime,
          isAsap,
          queuePosition,
          notes,
          status: "PENDING",
        },
      });

      const { token, tokenHash } = generateOrderToken(
        order.id,
        orderNumber,
        context.user!.id,
        queuePosition,
        pickupTime
      );
      const qrString = await generateQRString(order.id, token);
      let qrCodeDataUrl: string | null = null;
      try {
        qrCodeDataUrl = await generateQRCode(token);
      } catch (error) {
        console.error("QR generation failed", error);
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          token,
          tokenHash,
          qrData: qrCodeDataUrl ?? qrString,
        },
      });

      await tx.orderItem.createMany({
        data: body.items.map((item) => {
          const menuItem = menuItems.find((entry) => entry.id === item.menuItemId);
          const unitPrice = menuItem?.price ?? 0;
          return {
            orderId: order.id,
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            unitPrice,
            subtotal: Number(unitPrice) * item.quantity,
          };
        }),
      });

      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: total.toNumber(),
          status: "PENDING",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: context.user!.id,
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: order.id,
        },
      });

      return { ...order, token, qrData: qrCodeDataUrl ?? qrString };
    });

    return {
      orderId: created.id,
      orderNumber: created.orderNumber,
      totalAmount: Number(created.totalAmount),
      queuePosition,
      token: created.token,
      qrCodeDataUrl: created.qrData,
    };
  },
  { roles: ["USER", "STAFF", "ADMIN"], schema: createOrderSchema, requireAuth: true }
);

export const GET = apiHandler(
  async (_request, context) => {
    if (!context.user) {
      throw new Error("Unauthenticated");
    }

    const params = context.body ?? listSchema.parse({});
    const page = Number(params.page ?? "1");
    const limit = Math.min(Number(params.limit ?? "10"), 20);
    const skip = (page - 1) * limit;

    const statusList = (params.status ?? "")
      .split(",")
      .map((status) => status.trim())
      .filter(Boolean);
    const invalidStatus = statusList.find((status) => !ALLOWED_STATUSES.has(status));
    if (invalidStatus) {
      throw new AppError("Invalid status filter", 400, "ORDER_006", { status: invalidStatus });
    }

    const orders = await prisma.order.findMany({
      where: {
        userId: context.user.id,
        status: statusList.length > 0 ? { in: statusList as OrderStatus[] } : undefined,
      },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { menuItem: true },
        },
        payment: true,
      },
      skip,
      take: limit,
    });

    return {
      page,
      limit,
      orders: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        pickupTime: order.pickupTime.toISOString(),
        isAsap: order.isAsap,
        queuePosition: order.queuePosition,
        items: order.items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        })),
        paymentStatus: order.payment?.status ?? "PENDING",
        createdAt: order.createdAt.toISOString(),
      })),
    };
  },
  { roles: ["USER", "STAFF", "ADMIN"], schema: listSchema, requireAuth: true }
);