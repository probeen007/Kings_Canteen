import { apiHandler } from "@/lib/apiHandler";
import { AuthError, AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { emitOrderReady } from "@/lib/socket";

export const PATCH = apiHandler(
  async (request, context) => {
    if (!context.user || (context.user.role !== "STAFF" && context.user.role !== "ADMIN")) {
      throw new AuthError("Unauthorized", "AUTH_002");
    }

    const { id: orderId } = context.params as { id: string };

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: {
          select: { id: true },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_004");
    }

    // Only allow transitioning from CONFIRMED or PREPARING to READY
    if (order.status !== "CONFIRMED" && order.status !== "PREPARING") {
      throw new AppError("Order cannot be marked as ready", 400, "ORDER_005", {
        currentStatus: order.status,
      });
    }

    // Update order status to READY
    const updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "READY",
      },
    });

    // Emit Socket.io event to customer
    emitOrderReady(order.user.id, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      queuePosition: order.queuePosition,
    });

    // Log audit event
    await prisma.auditLog.create({
      data: {
        userId: context.user.id,
        action: "ORDER_MARKED_READY",
        entityType: "Order",
        entityId: orderId,
      },
    });

    return {
      success: true,
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  },
  {
    roles: ["STAFF", "ADMIN"],
    requireAuth: true,
  }
);
