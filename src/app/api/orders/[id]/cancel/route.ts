import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const PATCH = apiHandler(
  async (request, context) => {
    if (!context.user) {
      throw new AuthError("Unauthenticated", "AUTH_001");
    }

    const id = request.url.split("/").slice(-2)[0] ?? "";
    const order = await prisma.order.findUnique({
      where: { id },
      include: { payment: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_005");
    }

    if (order.userId !== context.user.id && context.user.role !== "ADMIN") {
      throw new AppError("Forbidden", 403, "AUTH_005");
    }

    if (order.status !== "PENDING" || order.payment?.status !== "PENDING") {
      throw new AppError("Order cannot be cancelled", 422, "ORDER_006");
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id },
        data: { status: "CANCELLED" },
      });

      if (order.payment) {
        await tx.payment.update({
          where: { id: order.payment.id },
          data: { status: "REFUNDED" },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: context.user!.id,
          action: "ORDER_CANCELLED",
          entityType: "Order",
          entityId: id,
        },
      });

      return { id };
    });

    return updated;
  },
  { roles: ["USER", "ADMIN"], requireAuth: true }
);
