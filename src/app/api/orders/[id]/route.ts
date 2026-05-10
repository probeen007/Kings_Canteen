import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError, NotFoundError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const GET = apiHandler(
  async (request, context) => {
    if (!context.user) {
      throw new AuthError("Unauthenticated", "AUTH_001");
    }

    const id = request.url.split("/").pop() ?? "";
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { menuItem: true } },
        payment: true,
        user: true,
      },
    });

    if (!order) {
      throw new NotFoundError("Order not found", "ORDER_005");
    }

    if (order.userId !== context.user.id && !["STAFF", "ADMIN"].includes(context.user.role)) {
      throw new AppError("Forbidden", 403, "AUTH_005");
    }

    return {
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
      user: { id: order.user.id, name: order.user.name },
      createdAt: order.createdAt.toISOString(),
    };
  },
  { roles: ["USER", "STAFF", "ADMIN"], requireAuth: true }
);