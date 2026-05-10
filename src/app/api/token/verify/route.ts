import { apiHandler } from "@/lib/apiHandler";
import { AppError, AuthError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { verifyOrderToken } from "@/lib/token";
import { z } from "zod";

const verifySchema = z.object({
  token: z.string().min(1, "Token required"),
});

export const POST = apiHandler(
  async (_request, context) => {
    if (!context.user || (context.user.role !== "STAFF" && context.user.role !== "ADMIN")) {
      throw new AuthError("Unauthorized", "AUTH_002");
    }

    const body = context.body ?? verifySchema.parse({});

    try {
      const decoded = verifyOrderToken(body.token);

      // Find order by tokenHash (we hash to find the matching order)
      const order = await prisma.order.findFirst({
        where: {
          id: decoded.orderId,
          token: body.token,
        },
        include: {
          items: {
            include: {
              menuItem: true,
            },
          },
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_004");
      }

      // Check if order is already claimed or cancelled
      if (order.status === "COMPLETED") {
        throw new AppError("Order already claimed", 400, "ORDER_CLAIMED");
      }
      if (order.status === "CANCELLED") {
        throw new AppError("Order has been cancelled", 400, "ORDER_CANCELLED");
      }

      // Update order status to COMPLETED
      await prisma.order.update({
        where: { id: order.id },
        data: { 
          status: "COMPLETED",
          completedAt: new Date()
        },
      });

      return {
        success: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          queuePosition: order.queuePosition,
          pickupTime: order.pickupTime.toISOString(),
          totalAmount: Number(order.totalAmount),
          customer: {
            name: order.user.name,
            email: order.user.email,
          },
          items: order.items.map((item) => ({
            menuItem: item.menuItem.name,
            quantity: item.quantity,
            subtotal: item.subtotal,
          })),
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("Token verification failed", 400, "TOKEN_001");
    }
  },
  {
    roles: ["STAFF", "ADMIN"],
    schema: verifySchema,
    requireAuth: true,
  }
);