import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import type { MenuItem } from "@/types/menu";

export type CartItem = MenuItem & { quantity: number };

type CartState = {
	items: CartItem[];
	totalItems: number;
	totalAmount: number;
	hydrated: boolean;
	addItem: (item: MenuItem, quantity?: number) => void;
	removeItem: (itemId: string) => void;
	updateQuantity: (itemId: string, quantity: number) => void;
	clearCart: () => void;
	setHydrated: () => void;
};

function calculateTotals(items: CartItem[]) {
	const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
	const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.price, 0);
	return { totalItems, totalAmount };
}

export const useCartStore = create<CartState>()(
	persist(
		(set, get) => ({
			items: [],
			totalItems: 0,
			totalAmount: 0,
			hydrated: false,
			addItem: (item, quantity = 1) => {
				const current = get().items;
				const existing = current.find((entry) => entry.id === item.id);
				const updated = existing
					? current.map((entry) =>
							entry.id === item.id
								? { ...entry, quantity: entry.quantity + quantity }
								: entry
						)
					: [...current, { ...item, quantity }];
				const totals = calculateTotals(updated);
				set({ items: updated, ...totals });
			},
			removeItem: (itemId) => {
				const updated = get().items.filter((item) => item.id !== itemId);
				const totals = calculateTotals(updated);
				set({ items: updated, ...totals });
			},
			updateQuantity: (itemId, quantity) => {
				const normalized = Math.max(1, quantity);
				const updated = get().items.map((item) =>
					item.id === itemId ? { ...item, quantity: normalized } : item
				);
				const totals = calculateTotals(updated);
				set({ items: updated, ...totals });
			},
			clearCart: () => set({ items: [], totalItems: 0, totalAmount: 0 }),
			setHydrated: () => set({ hydrated: true }),
		}),
		{
			name: "canteen-cart-v1",
			storage: createJSONStorage(() => localStorage),
			onRehydrateStorage: () => (state) => {
				state?.setHydrated();
			},
		}
	)
);