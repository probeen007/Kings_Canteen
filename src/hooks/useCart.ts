"use client";

import { useCartStore } from "@/store/cartStore";

export function useCart() {
	return useCartStore();
}