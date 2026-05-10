import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const updateItemSchema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(120)).optional(),
  description: z
    .union([z.string(), z.null()])
    .transform((value) => (typeof value === "string" ? value.trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ") : null))
    .nullable()
    .optional(),
  price: z.number().positive().optional(),
  imageUrl: z.string().url().nullable().optional(),
  categoryId: z.string().min(1).optional(),
  preparationMins: z.number().int().min(1).max(120).optional(),
  isAvailable: z.boolean().optional(),
});

export const PUT = apiHandler(
  async (request, context) => {
    const body = context.body ?? updateItemSchema.parse({});
    const id = request.url.split("/").pop() ?? "";
    const item = await prisma.menuItem.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description ?? undefined,
        price: body.price,
        imageUrl: body.imageUrl ?? undefined,
        categoryId: body.categoryId,
        preparationMins: body.preparationMins,
        isAvailable: body.isAvailable,
      },
    });
    try {
      await redis.del("menu:active:v1");
    } catch (error) {
      console.info("menu:cache-invalidate-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { id: item.id };
  },
  { roles: ["ADMIN"], schema: updateItemSchema, requireAuth: true }
);

export const DELETE = apiHandler(
  async (request) => {
    const id = request.url.split("/").pop() ?? "";
    await prisma.menuItem.update({
      where: { id },
      data: { isAvailable: false },
    });
    try {
      await redis.del("menu:active:v1");
    } catch (error) {
      console.info("menu:cache-invalidate-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { id };
  },
  { roles: ["ADMIN"], requireAuth: true }
);
