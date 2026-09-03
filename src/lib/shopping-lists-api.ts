import { api } from '$lib/api';
import type { ImportedShoppingList, ShoppingList, ShoppingListInput } from '$lib/types';

export async function listShoppingLists(): Promise<ShoppingList[]> {
	return api<ShoppingList[]>('/api/shopping-lists');
}

export async function getShoppingList(id: string): Promise<ShoppingList | null> {
	try {
		return await api<ShoppingList>(`/api/shopping-lists/${id}`);
	} catch (error) {
		if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
			return null;
		}
		throw error;
	}
}

export async function createShoppingList(input: ShoppingListInput): Promise<ShoppingList> {
	return api<ShoppingList>('/api/shopping-lists', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function importShoppingListFromImage(
	image: string,
	mimeType: string
): Promise<ImportedShoppingList> {
	return api<ImportedShoppingList>('/api/shopping-lists/import-image', {
		method: 'POST',
		body: JSON.stringify({ image, mimeType })
	});
}

export async function updateShoppingList(
	id: string,
	input: ShoppingListInput
): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

export async function updateShoppingListTitle(id: string, title: string): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${id}`, {
		method: 'PATCH',
		body: JSON.stringify({ title })
	});
}

export async function deleteShoppingList(id: string): Promise<void> {
	await api<void>(`/api/shopping-lists/${id}`, { method: 'DELETE' });
}

export async function addShoppingListItem(id: string, text: string): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${id}/items`, {
		method: 'POST',
		body: JSON.stringify({ text })
	});
}

export async function toggleShoppingListItem(
	listId: string,
	itemId: string
): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${listId}/items/${itemId}`, {
		method: 'PATCH'
	});
}

export async function removeShoppingListItem(
	listId: string,
	itemId: string
): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${listId}/items/${itemId}`, {
		method: 'DELETE'
	});
}

export async function addRecipeToShoppingList(
	listId: string,
	recipeId: string
): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/shopping-lists/${listId}/recipes`, {
		method: 'POST',
		body: JSON.stringify({ recipeId })
	});
}
