import { api } from '$lib/api';
import type { Recipe, RecipeInput } from '$lib/types';

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
