export type MenuItem = {
	id: string;
	name: string;
	description: string | null;
	price: number;
	imageUrl: string | null;
	isAvailable: boolean;
	preparationMins: number;
};

export type MenuCategory = {
	id: string;
	name: string;
	slug: string;
	items: MenuItem[];
};

export type MenuCategorySummary = {
	id: string;
	name: string;
	slug: string;
	itemCount: number;
};

export type MenuItemsPage = {
	items: MenuItem[];
	nextCursor: string | null;
};