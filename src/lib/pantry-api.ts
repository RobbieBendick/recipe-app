import { api } from '$lib/api';
import type { PantryItem, PantryItemInput } from '$lib/types';

export async function listPantry(): Promise<PantryItem[]> {
	return api<PantryItem[]>('/api/pantry');
}

export async function createPantryItem(input: PantryItemInput): Promise<PantryItem> {
	return api<PantryItem>('/api/pantry', {
		method: 'POST',
		body: JSON.stringify(input)
	});
}

export async function updatePantryItem(id: string, input: PantryItemInput): Promise<PantryItem> {
	return api<PantryItem>(`/api/pantry/${id}`, {
		method: 'PUT',
		body: JSON.stringify(input)
	});
}

export async function togglePantryStock(id: string): Promise<PantryItem> {
	return api<PantryItem>(`/api/pantry/${id}`, { method: 'PATCH' });
}

export async function deletePantryItem(id: string): Promise<void> {
	await api<void>(`/api/pantry/${id}`, { method: 'DELETE' });
}

export async function replacePantry(items: PantryItemInput[]): Promise<PantryItem[]> {
	return api<PantryItem[]>('/api/pantry', {
		method: 'PUT',
		body: JSON.stringify(items)
	});
}
