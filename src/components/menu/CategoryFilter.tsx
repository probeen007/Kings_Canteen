import type { MenuCategorySummary } from "@/types/menu";

type CategoryFilterProps = {
  categories: MenuCategorySummary[];
  activeSlug: string;
  onChange: (slug: string) => void;
};

export function CategoryFilter({ categories, activeSlug, onChange }: CategoryFilterProps) {
  return (
    <div className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-4 py-3">
      {categories.map((category) => {
        const active = category.slug === activeSlug;
        return (
          <button
            key={category.id}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
              active
                ? "bg-[#0b2447] text-white shadow-sm"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
            onClick={() => onChange(category.slug)}
            type="button"
          >
            {category.name}
          </button>
        );
      })}
    </div>
  );
}