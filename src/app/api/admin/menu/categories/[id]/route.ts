import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const updateCategorySchema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(100)).optional(),
  slug: z
    .string()
    .transform((value) => value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, ""))
    .pipe(z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers, and hyphens only"))
    .optional(),
  description: z
    .union([z.string(), z.null()])
    .transform((value) => (typeof value === "string" ? value.trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ") : null))
    .nullable()
    .optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const PUT = apiHandler(
  async (request, context) => {
    const body = context.body ?? updateCategorySchema.parse({});
    const id = request.url.split("/").pop() ?? "";
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description ?? undefined,
        imageUrl: body.imageUrl ?? undefined,
        sortOrder: body.sortOrder,
        isActive: body.isActive,
      },
    });
    await redis.del("menu:active:v1");
    return { id: category.id };
  },
  { roles: ["ADMIN"], schema: updateCategorySchema, requireAuth: true }
);

export const DELETE = apiHandler(
  async (request) => {
    const id = request.url.split("/").pop() ?? "";
    await prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await redis.del("menu:active:v1");
    return { id };
  },
  { roles: ["ADMIN"], requireAuth: true }
);
