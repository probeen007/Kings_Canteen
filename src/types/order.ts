export type OrderStatus =
	| "PENDING"
	| "CONFIRMED"
	| "PREPARING"
	| "READY"
	| "COMPLETED"
	| "CANCELLED";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";

export type OrderItem = {
	id: string;
	menuItemId: string;
	name: string;
	quantity: number;
	unitPrice: number;
	subtotal: number;
};

export type Order = {
	id: string;
	orderNumber: string;
	status: OrderStatus;
	totalAmount: number;
	pickupTime: string;
	queuePosition: number | null;
	items: OrderItem[];
	paymentStatus: PaymentStatus;
	createdAt: string;
};