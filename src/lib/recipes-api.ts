import { api } from '$lib/api';
import type { ImportedRecipe, Recipe, RecipeInput } from '$lib/types';

export async function listRecipes(): Promise<Recipe[]> {
	return api<Recipe[]>('/api/recipes');
}

export async function getRecipe(id: string): Promise<Recipe | null> {
	try {
		return await api<Recipe>(`/api/recipes/${id}`);
	} catch (error) {
		if (error instanceof Error && 'status' in error && (error as { status: number }).status === 404) {
			return null;
		}
		throw error;
	}
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
	return api<Recipe>('/api/recipes', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function importRecipeFromUrl(url: string): Promise<ImportedRecipe> {
	return api<ImportedRecipe>('/api/recipes/import-url', {
		method: 'POST',
		body: JSON.stringify({ url })
	});
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<Recipe> {
	return api<Recipe>(`/api/recipes/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

export async function deleteRecipe(id: string): Promise<void> {
	await api<void>(`/api/recipes/${id}`, { method: 'DELETE' });
}

export async function makeShoppingListFromRecipe(id: string) {
	return api(`/api/recipes/${id}/shopping-list`, { method: 'POST' });
}

export async function shareRecipe(id: string, friendUserId: string) {
	return api(`/api/recipes/${id}/share`, {
		method: 'POST',
		body: JSON.stringify({ friendUserId })
	});
}

export async function acceptRecipeShare(shareId: string): Promise<Recipe> {
	return api<Recipe>(`/api/recipe-shares/${shareId}/accept`, {
		method: 'POST'
	});
}

export async function declineRecipeShare(shareId: string): Promise<void> {
	await api<void>(`/api/recipe-shares/${shareId}/decline`, { method: 'POST' });
}
