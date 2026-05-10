import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const createItemSchema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(120)),
  description: z
    .union([z.string(), z.null()])
    .transform((value) => (typeof value === "string" ? value.trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ") : null))
    .nullable()
    .optional(),
  price: z.number().positive(),
  imageUrl: z.string().url().nullable().optional(),
  categoryId: z.string().min(1),
  preparationMins: z.number().int().min(1).max(120).optional(),
});

export const POST = apiHandler(
  async (_request, context) => {
    const body = context.body ?? createItemSchema.parse({});
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        description: body.description ?? null,
        price: body.price,
        imageUrl: body.imageUrl ?? null,
        categoryId: body.categoryId,
        preparationMins: body.preparationMins ?? 10,
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
  { roles: ["ADMIN"], schema: createItemSchema, requireAuth: true }
);
