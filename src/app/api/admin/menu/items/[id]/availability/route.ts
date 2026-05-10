import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const availabilitySchema = z.object({
  isAvailable: z.boolean(),
});

export const PATCH = apiHandler(
  async (request, context) => {
    const body = context.body ?? availabilitySchema.parse({});
    const id = request.url.split("/").pop() ?? "";
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: body.isAvailable },
    });
    await redis.del("menu:active:v1");
    return { id: item.id, isAvailable: item.isAvailable };
  },
  { roles: ["ADMIN"], schema: availabilitySchema, requireAuth: true }
);
