"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchWithRetry } from "@/lib/fetcher";

import { CategoryFilter } from "@/components/menu/CategoryFilter";
import { MenuCard } from "@/components/menu/MenuCard";
import { SearchBar } from "@/components/menu/SearchBar";
import type { MenuCategorySummary, MenuItem, MenuItemsPage } from "@/types/menu";

const PAGE_LIMIT = 12;
const MENU_CACHE_KEY = "menu:summary:v1";
const MENU_ITEMS_CACHE_PREFIX = "menu:items:v1:";
const MENU_CACHE_TTL_MS = 5 * 60 * 1000;
const SKELETON_DELAY_MS = 400;

type MenuCache<T> = { fetchedAt: number; data: T };

function readMenuCache<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MenuCache<T>;
    if (!parsed?.fetchedAt) return null;
    if (Date.now() - parsed.fetchedAt > MENU_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeMenuCache<T>(key: string, data: T) {
  try {
    const payload: MenuCache<T> = { fetchedAt: Date.now(), data };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Ignore cache write failures
  }
}

function SkeletonCard() {
  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="h-32 w-full rounded-xl bg-neutral-100 animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-neutral-100 animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-neutral-100 animate-pulse" />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="h-4 w-16 rounded bg-neutral-100 animate-pulse" />
        <div className="h-8 w-20 rounded-full bg-neutral-100 animate-pulse" />
      </div>
    </div>
  );
}

function SkeletonPills() {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-neutral-200 bg-white px-4 py-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-9 w-24 rounded-full bg-neutral-100 animate-pulse" />
      ))}
    </div>
  );
}

export function MenuBrowser() {
  const [categories, setCategories] = useState<MenuCategorySummary[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [query, setQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCategorySkeleton, setShowCategorySkeleton] = useState(false);
  const [showItemsSkeleton, setShowItemsSkeleton] = useState(false);
  const observerRef = useRef<HTMLDivElement | null>(null);
  const categorySkeletonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const itemsSkeletonTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.name} ${item.description ?? ""}`.toLowerCase().includes(normalized));
  }, [items, query]);

  const showInitialSkeleton = loadingItems && items.length === 0 && showItemsSkeleton;
  const showAppendSkeleton = !query && loadingMore;
  const skeletonCount = showInitialSkeleton ? 6 : showAppendSkeleton ? 4 : 0;

  useEffect(() => {
    if (loadingCategories) {
      if (categorySkeletonTimer.current) clearTimeout(categorySkeletonTimer.current);
      categorySkeletonTimer.current = setTimeout(() => {
        setShowCategorySkeleton(true);
      }, SKELETON_DELAY_MS);
    } else {
      if (categorySkeletonTimer.current) clearTimeout(categorySkeletonTimer.current);
      setShowCategorySkeleton(false);
    }

    return () => {
      if (categorySkeletonTimer.current) clearTimeout(categorySkeletonTimer.current);
    };
  }, [loadingCategories]);

  useEffect(() => {
    if (loadingItems && items.length === 0) {
      if (itemsSkeletonTimer.current) clearTimeout(itemsSkeletonTimer.current);
      itemsSkeletonTimer.current = setTimeout(() => {
        setShowItemsSkeleton(true);
      }, SKELETON_DELAY_MS);
    } else {
      if (itemsSkeletonTimer.current) clearTimeout(itemsSkeletonTimer.current);
      setShowItemsSkeleton(false);
    }

    return () => {
      if (itemsSkeletonTimer.current) clearTimeout(itemsSkeletonTimer.current);
    };
  }, [loadingItems, items.length]);

  useEffect(() => {
    let cancelled = false;
    const loadCategories = async () => {
      setLoadingCategories(true);
      setError(null);

      const cached = readMenuCache<MenuCategorySummary[]>(MENU_CACHE_KEY);
      if (cached && cached.length) {
        const totalCount = cached.reduce((sum, category) => sum + category.itemCount, 0);
        const withAll: MenuCategorySummary[] = [
          { id: "all", name: "All", slug: "all", itemCount: totalCount },
          ...cached,
        ];
        if (!cancelled) {
          setCategories(withAll);
          setActiveSlug((prev) => prev || "all");
          setLoadingCategories(false);
        }
        return;
      }

      try {
        const response = await fetchWithRetry(`/api/menu?summary=1`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("menu-summary");
        }
        const payload = (await response.json()) as { data?: { categories?: MenuCategorySummary[] } };
        const list = payload.data?.categories ?? [];
        writeMenuCache(MENU_CACHE_KEY, list);
        const totalCount = list.reduce((sum, category) => sum + category.itemCount, 0);
        const withAll: MenuCategorySummary[] = [
          { id: "all", name: "All", slug: "all", itemCount: totalCount },
          ...list,
        ];
        if (!cancelled) {
          setCategories(withAll);
          setActiveSlug((prev) => prev || "all");
        }
      } catch {
        if (!cancelled) setError("Unable to load the menu right now.");
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    };
    loadCategories();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchItems = async (slug: string, cursor: string | null, append: boolean) => {
    const params = new URLSearchParams({ category: slug, limit: String(PAGE_LIMIT) });
    if (cursor) params.set("cursor", cursor);
    if (!cursor && !append) {
      const cached = readMenuCache<MenuItemsPage>(`${MENU_ITEMS_CACHE_PREFIX}${slug}`);
      if (cached) return cached;
    }
    const response = await fetchWithRetry(`/api/menu?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("menu-items");
    }
    const payload = (await response.json()) as { data?: MenuItemsPage };
    const page = payload.data ?? { items: [], nextCursor: null };
    if (!cursor && !append) {
      writeMenuCache(`${MENU_ITEMS_CACHE_PREFIX}${slug}`, page);
    }
    return page;
  };

  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    const loadItems = async () => {
      setLoadingItems(true);
      setIsRefreshing(true);
      setError(null);
      try {
        const page = await fetchItems(activeSlug, null, false);
        if (!cancelled) {
          setItems(page.items);
          setNextCursor(page.nextCursor);
        }
      } catch {
        if (!cancelled) setError("Unable to load items.");
      } finally {
        if (!cancelled) setLoadingItems(false);
        if (!cancelled) setIsRefreshing(false);
      }
    };
    setItems([]);
    loadItems();
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  useEffect(() => {
    if (!observerRef.current) return;
    if (!nextCursor || loadingMore || loadingItems) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setLoadingMore(true);
        fetchItems(activeSlug, nextCursor, true)
          .then((page) => {
            setItems((prev) => [...prev, ...page.items]);
            setNextCursor(page.nextCursor);
          })
          .catch(() => setError("Unable to load more items."))
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "200px" }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [activeSlug, nextCursor, loadingMore, loadingItems]);

  if (error) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {loadingCategories && showCategorySkeleton ? (
        <SkeletonPills />
      ) : (
        <CategoryFilter categories={categories as any} activeSlug={activeSlug} onChange={setActiveSlug} />
      )}
      <SearchBar value={query} onChange={setQuery} />

      {showInitialSkeleton || filteredItems.length || skeletonCount > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {filteredItems.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
          {Array.from({ length: skeletonCount }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/80 p-8 text-center text-sm text-slate-500">
          No items match this category.
        </div>
      )}

      {nextCursor ? (
        <div className="flex flex-col items-center gap-3 pt-2">
          <div ref={observerRef} />
          {loadingMore ? (
            <div className="text-xs text-slate-500">Loading more...</div>
          ) : (
            <button
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700"
              onClick={() => {
                if (!nextCursor) return;
                setLoadingMore(true);
                fetchItems(activeSlug, nextCursor, true)
                  .then((page) => {
                    setItems((prev) => [...prev, ...page.items]);
                    setNextCursor(page.nextCursor);
                  })
                  .catch(() => setError("Unable to load more items."))
                  .finally(() => setLoadingMore(false));
              }}
              type="button"
            >
              Load more
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
