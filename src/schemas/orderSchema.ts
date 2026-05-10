import { z } from "zod";

export const orderItemSchema = z.object({
	menuItemId: z.string().min(1),
	quantity: z.number().int().min(1).max(20),
});

export const createOrderSchema = z.object({
	items: z.array(orderItemSchema).min(1).max(20),
	pickupTime: z.string().datetime(),
	notes: z.string().max(200).optional(),
});