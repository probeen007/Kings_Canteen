"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  items: MenuItem[];
};

type MenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: string;
  isAvailable: boolean;
  preparationMins: number;
  categoryId: string;
};

type Props = {
  categories: Category[];
};

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "");
}

function normalizeText(value: string) {
  return stripHtml(value).replace(/\s+/g, " ").trim();
}

function normalizeSlug(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\u0000-\u007E]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeDescription(value: string) {
  const cleaned = normalizeText(value);
  return cleaned.length ? cleaned.slice(0, 500) : "";
}

function sanitizePrice(value: string) {
  const cleaned = value.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(cleaned);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Number(parsed.toFixed(2));
}

async function callApi(url: string, method: string, body?: Record<string, unknown>) {
  const response = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = (await response.json().catch(() => null)) as { success?: boolean; error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? "Request failed");
  }
  return payload;
}

function FieldLabel({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export function MenuManager({ categories }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "" });
  const [itemForm, setItemForm] = useState({ name: "", description: "", price: "", categoryId: categories[0]?.id ?? "" });
  const [error, setError] = useState<string | null>(null);

  const activeCategories = useMemo(() => categories.filter((category) => category.isActive), [categories]);
  const hasAddableCategory = activeCategories.length > 0;

  useEffect(() => {
    if (!hasAddableCategory) {
      setItemForm((prev) => ({ ...prev, categoryId: "" }));
      return;
    }

    setItemForm((prev) => {
      if (prev.categoryId && activeCategories.some((category) => category.id === prev.categoryId)) {
        return prev;
      }

      return { ...prev, categoryId: activeCategories[0]?.id ?? "" };
    });
  }, [activeCategories, hasAddableCategory]);

  const refresh = () => startTransition(() => router.refresh());

  const createCategory = async () => {
    setError(null);
    const name = normalizeText(categoryForm.name);
    const slug = normalizeSlug(categoryForm.slug || categoryForm.name);
    const description = normalizeDescription(categoryForm.description);

    if (name.length < 2 || slug.length < 2) {
      setError("Category name and slug are required.");
      return;
    }

    if (isCreatingCategory) return;
    setIsCreatingCategory(true);
    try {
      await callApi("/api/admin/menu/categories", "POST", {
        name,
        slug,
        description: description || null,
      });
      setCategoryForm({ name: "", slug: "", description: "" });
      toast.success("Category created");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create category";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  const createItem = async () => {
    setError(null);
    const name = normalizeText(itemForm.name);
    const description = normalizeDescription(itemForm.description);
    const price = sanitizePrice(itemForm.price);

    if (name.length < 2) {
      setError("Item name is required.");
      return;
    }

    if (price === null) {
      setError("Enter a valid price.");
      return;
    }

    if (isCreatingItem) return;
    setIsCreatingItem(true);
    try {
      await callApi("/api/admin/menu/items", "POST", {
        name,
        description: description || null,
        price,
        categoryId: itemForm.categoryId,
      });
      setItemForm((prev) => ({ ...prev, name: "", description: "", price: "" }));
      toast.success("Item created");
      refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create item";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreatingItem(false);
    }
  };

  const deleteCategory = async (id: string) => {
    await callApi(`/api/admin/menu/categories/${id}`, "DELETE");
    refresh();
  };

  const deleteItem = async (id: string) => {
    await callApi(`/api/admin/menu/items/${id}`, "DELETE");
    refresh();
  };

  const toggleItemAvailability = async (item: MenuItem) => {
    await callApi(`/api/admin/menu/items/${item.id}`, "PUT", {
      isAvailable: !item.isAvailable,
    });
    refresh();
  };

  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:gap-6">
        <section className="rounded-2xl border border-[#eadbcc] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
          <h3 className="text-base font-semibold text-[#2f2118]">Add category</h3>
          <p className="mt-1 text-sm text-neutral-600">Keep it short and descriptive.</p>
          <div className="mt-4 grid gap-3">
            <FieldLabel label="Category name">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
                placeholder="Breakfast"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value.slice(0, 100), slug: prev.slug || normalizeSlug(e.target.value).slice(0, 120) }))}
                maxLength={100}
                autoComplete="off"
              />
            </FieldLabel>
            <FieldLabel label="Slug">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
                placeholder="breakfast"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, slug: normalizeSlug(e.target.value).slice(0, 120) }))}
                maxLength={120}
                autoComplete="off"
              />
            </FieldLabel>
            <FieldLabel label="Description" hint="Optional">
              <textarea
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white"
                placeholder="Simple breakfast items"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                maxLength={500}
              />
            </FieldLabel>
            <button
              className="inline-flex items-center justify-center rounded-xl bg-[#5b3418] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#4a2a14] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || isCreatingCategory}
              onClick={createCategory}
              type="button"
            >
              {isCreatingCategory ? "Saving..." : "Save category"}
            </button>
          </div>
        </section>

        <section className={`rounded-2xl border bg-white p-4 shadow-sm sm:p-5 lg:p-6 ${hasAddableCategory ? "border-[#eadbcc]" : "border-slate-200 opacity-90"}`}>
          <h3 className="text-base font-semibold text-[#2f2118]">Add item</h3>
          <p className="mt-1 text-sm text-neutral-600">Use simple names and numeric prices.</p>
          {!hasAddableCategory ? <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Create a category first to enable item creation.</p> : null}
          <div className="mt-4 grid gap-3">
            <FieldLabel label="Item name">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Tea"
                value={itemForm.name}
                onChange={(e) => setItemForm((prev) => ({ ...prev, name: e.target.value.slice(0, 120) }))}
                maxLength={120}
                autoComplete="off"
                disabled={!hasAddableCategory}
              />
            </FieldLabel>
            <FieldLabel label="Price">
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="120"
                inputMode="decimal"
                value={itemForm.price}
                onChange={(e) => setItemForm((prev) => ({ ...prev, price: e.target.value.replace(/[^\d.]/g, "").slice(0, 12) }))}
                autoComplete="off"
                disabled={!hasAddableCategory}
              />
            </FieldLabel>
            <FieldLabel label="Category">
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                value={itemForm.categoryId}
                onChange={(e) => setItemForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                disabled={!hasAddableCategory}
              >
                {activeCategories.length === 0 ? <option value="">No categories available</option> : null}
                {activeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FieldLabel>
            <FieldLabel label="Description" hint="Optional">
              <textarea
                className="min-h-20 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:bg-white disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                placeholder="Light and fresh"
                value={itemForm.description}
                onChange={(e) => setItemForm((prev) => ({ ...prev, description: e.target.value.slice(0, 500) }))}
                maxLength={500}
                disabled={!hasAddableCategory}
              />
            </FieldLabel>
            <button
              className="inline-flex items-center justify-center rounded-xl bg-[#9a5b21] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#7c491b] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending || isCreatingItem || !hasAddableCategory || !itemForm.categoryId}
              onClick={createItem}
              type="button"
            >
              {isCreatingItem ? "Saving..." : "Save item"}
            </button>
          </div>
        </section>
      </div>

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

      <section className="space-y-3 sm:space-y-4">
        {categories.map((category) => (
          <div key={category.id} className="rounded-2xl border border-[#eadbcc] bg-white p-4 shadow-sm sm:p-5 lg:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-[#2f2118] sm:text-lg">{category.name}</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${category.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {category.isActive ? "Active" : "Hidden"}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{category.description ?? "No description"}</p>
              </div>
              <button
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                onClick={() => deleteCategory(category.id)}
                type="button"
              >
                Hide category
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {category.items.map((item) => (
                <article key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-slate-900 sm:text-[15px]">{item.name}</h4>
                      <p className="mt-1 text-sm text-slate-600">Rs. {item.price}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${item.isAvailable ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                      {item.isAvailable ? "Available" : "Hidden"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description ?? "No description"}</p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      className="w-full rounded-xl bg-[#5b3418] px-3 py-2 text-sm font-medium text-white transition hover:bg-[#4a2a14] sm:w-auto"
                      onClick={() => toggleItemAvailability(item)}
                      type="button"
                    >
                      Toggle
                    </button>
                    <button
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-white sm:w-auto"
                      onClick={() => deleteItem(item.id)}
                      type="button"
                    >
                      Hide item
                    </button>
                  </div>
                </article>
              ))}
              {category.items.length === 0 ? <p className="text-sm text-neutral-500">No items in this category yet.</p> : null}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
