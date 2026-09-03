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
	prepMinutes?: number;
	cookMinutes?: number;
	servings?: number;
	createdAt: string;
	updatedAt: string;
};

export type ShoppingListItem = {
	id: string;
	text: string;
	checked: boolean;
	sourceRecipeId?: string;
};

export type PublicUser = {
	id: string;
	email: string;
	name: string;
	avatarUrl: string;
	nickname?: string;
};

export type ShoppingList = {
	id: string;
	title: string;
	emoji: string;
	items: ShoppingListItem[];
	recipeCounts?: Record<string, number>;
	sharedWith?: PublicUser;
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
	prepMinutes?: number;
	cookMinutes?: number;
	servings?: number;
};

export type ImportedRecipe = {
	title: string;
	description: string;
	ingredients: string[];
	steps: string[];
	prepMinutes: number;
	cookMinutes: number;
	servings: number;
	sourceUrl: string;
};

export type ShoppingListInput = {
	title: string;
	emoji?: string;
	items: string[];
	sourceRecipeId?: string;
	recipeCounts?: Record<string, number>;
};

export type ImportedShoppingList = {
	title: string;
	items: string[];
};

export type PantryItemInput = {
	name: string;
	emoji: string;
	notes: string;
	inStock: boolean;
	percent: number;
	unit: 'percent' | 'count';
	sharedPantryId?: string;
};

export type SharedPantry = {
	id: string;
	sharedWith?: PublicUser;
	items: PantryItem[];
};

export type Friendship = {
	id: string;
	requesterId: string;
	addresseeId: string;
	status: 'pending' | 'accepted' | 'declined';
	createdAt: string;
	updatedAt: string;
	otherUser?: PublicUser;
};

export type FriendRequests = {
	incoming: Friendship[];
	outgoing: Friendship[];
};

export type NotificationData = {
	friendshipId?: string;
	shareId?: string;
	recipeId?: string;
	recipeTitle?: string;
	recipeEmoji?: string;
	listId?: string;
	pantryId?: string;
	fromUserId?: string;
	fromName?: string;
	fromEmail?: string;
	fromAvatarUrl?: string;
};

export type AppNotification = {
	id: string;
	userId: string;
	type:
		| 'friend_request'
		| 'friend_accepted'
		| 'recipe_share'
		| 'recipe_share_accepted'
		| 'shared_shopping_list'
		| string;
	title: string;
	body: string;
	data: NotificationData;
	readAt?: string | null;
	createdAt: string;
};
