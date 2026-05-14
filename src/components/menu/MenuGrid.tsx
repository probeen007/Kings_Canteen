"use client";

import { useMemo, useState } from "react";

import { CategoryFilter } from "@/components/menu/CategoryFilter";
import { MenuCard } from "@/components/menu/MenuCard";
import { SearchBar } from "@/components/menu/SearchBar";
import type { MenuCategory, MenuCategorySummary } from "@/types/menu";

type MenuGridProps = {
  categories: MenuCategory[];
};

export function MenuGrid({ categories }: MenuGridProps) {
  const [activeSlug, setActiveSlug] = useState(categories[0]?.slug ?? "");
  const [query, setQuery] = useState("");

  const categorySummaries = useMemo<MenuCategorySummary[]>(
    () =>
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        itemCount: category.items.length,
      })),
    [categories]
  );

  const activeCategory = categories.find((category) => category.slug === activeSlug) ?? categories[0];

  const filteredItems = useMemo(() => {
    if (!activeCategory) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return activeCategory.items || [];
    return (activeCategory.items || []).filter((item) =>
      `${item.name} ${item.description ?? ""}`.toLowerCase().includes(normalized)
    );
  }, [activeCategory, query]);

  if (!categories.length) {
    return <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center">No menu items.</div>;
  }

  return (
    <div className="space-y-4">
      <CategoryFilter categories={categorySummaries} activeSlug={activeSlug} onChange={setActiveSlug} />
      <SearchBar value={query} onChange={setQuery} />
      {filteredItems.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {filteredItems.map((item) => (
            <MenuCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-500">
          No items match this category.
        </div>
      )}
    </div>
  );
}