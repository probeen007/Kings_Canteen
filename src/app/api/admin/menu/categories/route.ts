import { z } from "zod";

import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const trimmedString = (min: number, max: number) =>
  z.string().transform((value) => value.trim().replace(/\s+/g, " ")).refine((value) => value.length >= min, {
    message: `Must be at least ${min} characters`,
  }).refine((value) => value.length <= max, {
    message: `Must be at most ${max} characters`,
  });

const createCategorySchema = z.object({
  name: z.string().transform((value) => value.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(100)),
  slug: z
    .string()
    .transform((value) => value.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, ""))
    .pipe(z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain lowercase letters, numbers, and hyphens only")),
  description: z
    .union([z.string(), z.null()])
    .transform((value) => (typeof value === "string" ? value.trim().replace(/<[^>]*>/g, "").replace(/\s+/g, " ") : null))
    .nullable()
    .optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

export const POST = apiHandler(
  async (_request, context) => {
    const body = context.body ?? createCategorySchema.parse({});
    const category = await prisma.category.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description ?? null,
        imageUrl: body.imageUrl ?? null,
        sortOrder: body.sortOrder ?? 0,
      },
    });
    try {
      await redis.del("menu:active:v1");
    } catch (error) {
      console.info("menu:cache-invalidate-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return { id: category.id };
  },
  { roles: ["ADMIN"], schema: createCategorySchema, requireAuth: true }
);
