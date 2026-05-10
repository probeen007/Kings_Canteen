import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { getQueuePosition } from "@/lib/redis";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rateLimiter";
import { calculateTotal, generateOrderNumber, sanitizeInput } from "@/lib/utils";
import { createOrderSchema } from "@/schemas/orderSchema";
import { generateOrderToken } from "@/lib/token";
import { generateQRCode, generateQRString } from "@/lib/qr";

const listSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z
    .enum(["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"])
    .optional(),
});

function validatePickupTime(value: string) {
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
  { roles: ["USER"], schema: createOrderSchema, requireAuth: true }
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

    const orders = await prisma.order.findMany({
      where: {
        userId: context.user.id,
        status: params.status,
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
  { roles: ["USER"], schema: listSchema, requireAuth: true }
);