export type User = {
	id: string;
	email: string;
	name: string;
	avatarUrl: string;
	krogerZip?: string;
	krogerLocationId?: string;
	krogerStoreName?: string;
	createdAt: string;
	updatedAt: string;
};

export type AuthResponse = {
	token: string;
	user: User;
};

export type Recipe = {
	id: string;
	title: string;
	description: string;
	emoji: string;
	ingredients: string[];
	steps: string[];
	createdAt: string;
	updatedAt: string;
};

export type ShoppingListItem = {
	id: string;
	text: string;
	checked: boolean;
	sourceRecipeId?: string;
};

export type ShoppingList = {
	id: string;
	title: string;
	emoji: string;
	items: ShoppingListItem[];
	createdAt: string;
	updatedAt: string;
};

export type PantryItem = {
	id: string;
	name: string;
	emoji: string;
	notes: string;
	inStock: boolean;
	percent: number;
	unit: 'percent' | 'count';
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
};

export type RecipeInput = {
	title: string;
	description: string;
	emoji: string;
	ingredients: string[];
	steps: string[];
};

export type ShoppingListInput = {
	title: string;
	emoji?: string;
	items: string[];
	sourceRecipeId?: string;
};

export type PantryItemInput = {
	name: string;
	emoji: string;
	notes: string;
	inStock: boolean;
	percent: number;
	unit: 'percent' | 'count';
};
