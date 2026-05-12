import { apiHandler } from "@/lib/apiHandler";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";

const SUMMARY_CACHE_KEY = "menu:summary:v1";
const ITEMS_CACHE_PREFIX = "menu:items:v1";

export const GET = apiHandler(async (request) => {
  const url = new URL(request.url);
  const summary = url.searchParams.get("summary");
  const category = url.searchParams.get("category");
  const cursor = url.searchParams.get("cursor");
  const limitParam = url.searchParams.get("limit");
  const limit = Math.min(Math.max(Number(limitParam) || 12, 6), 40);

  if (summary === "1") {
    try {
      const cached = (await redis.get(SUMMARY_CACHE_KEY)) as { categories: unknown } | null;
      if (cached) return cached;
    } catch (error) {
      console.info("menu:summary-cache-read-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        _count: { select: { items: true } },
      },
    });

    const payload = {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        itemCount: category._count.items,
      })),
    };

    try {
      await redis.set(SUMMARY_CACHE_KEY, payload, { ex: 300 });
    } catch (error) {
      console.info("menu:summary-cache-write-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return payload;
  }

  if (!category) {
    return { items: [], nextCursor: null };
  }

  const cacheKey = cursor ? null : `${ITEMS_CACHE_PREFIX}:${category}:limit:${limit}`;
  if (cacheKey) {
    try {
      const cached = (await redis.get(cacheKey)) as { items: unknown; nextCursor: string | null } | null;
      if (cached) return cached;
    } catch (error) {
      console.info("menu:items-cache-read-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const items = await prisma.menuItem.findMany({
    where: {
      isAvailable: true,
      category: category === "all"
        ? { isActive: true }
        : { slug: category, isActive: true },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  const hasMore = items.length > limit;
  const sliced = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.id ?? null : null;

  const payload = {
    items: sliced.map((item) => ({
      id: item.id,
      name: item.name,
      price: Number(item.price),
      description: item.description,
      imageUrl: item.imageUrl,
      isAvailable: item.isAvailable,
      preparationMins: item.preparationMins,
    })),
    nextCursor,
  };

  if (cacheKey) {
    try {
      await redis.set(cacheKey, payload, { ex: 120 });
    } catch (error) {
      console.info("menu:items-cache-write-failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return payload;
});