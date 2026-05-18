import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MenuManager } from "@/components/admin/MenuManager";

export const metadata: Metadata = {
  title: "Menu Manager",
};

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-[28px] border border-red-200 bg-red-50 p-6 shadow-sm">
      <h1 className="text-2xl font-bold text-red-900">{title}</h1>
      <p className="mt-2 text-sm text-red-700">{message}</p>
    </div>
  );
}

export default async function Page() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return <ErrorState title="Access denied" message="You must sign in as an admin to manage the menu." />;
    }

    const categories = await prisma.category.findMany({
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        items: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return (
      <section className="space-y-6">
        <MenuManager
          categories={categories.map((category) => ({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            sortOrder: category.sortOrder,
            isActive: category.isActive,
            items: category.items.map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price.toString(),
              isAvailable: item.isAvailable,
              preparationMins: item.preparationMins,
              categoryId: item.categoryId,
            })),
          }))}
        />
      </section>
    );
  } catch (error) {
    return <ErrorState title="Menu unavailable" message="We couldn't load menu management right now. Please try again." />;
  }
}
