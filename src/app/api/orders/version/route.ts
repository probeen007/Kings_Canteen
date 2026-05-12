import { apiHandler } from "@/lib/apiHandler";
import { AuthError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";

export const GET = apiHandler(
  async (_request, context) => {
    if (!context.user) {
      throw new AuthError("Unauthenticated", "AUTH_001");
    }

    const summary = await prisma.order.aggregate({
      where: { userId: context.user.id },
      _count: { _all: true },
      _max: { updatedAt: true },
    });

    const version = `${summary._count._all}:${summary._max.updatedAt?.toISOString() ?? "0"}`;

    return { version };
  },
  { roles: ["USER", "STAFF", "ADMIN"], requireAuth: true }
);
