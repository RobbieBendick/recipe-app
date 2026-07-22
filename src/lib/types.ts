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
	recipeCounts?: Record<string, number>;
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
	recipeCounts?: Record<string, number>;
};

export type PantryItemInput = {
	name: string;
	emoji: string;
	notes: string;
	inStock: boolean;
	percent: number;
	unit: 'percent' | 'count';
};

export type PublicUser = {
	id: string;
	email: string;
	name: string;
	avatarUrl: string;
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
	fromUserId?: string;
	fromName?: string;
	fromEmail?: string;
	fromAvatarUrl?: string;
};

export type AppNotification = {
	id: string;
	userId: string;
	type: 'friend_request' | 'friend_accepted' | 'recipe_share' | 'recipe_share_accepted' | string;
	title: string;
	body: string;
	data: NotificationData;
	readAt?: string | null;
	createdAt: string;
};
