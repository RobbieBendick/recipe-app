import { api } from '$lib/api';
import type { User } from '$lib/types';

export type EstimateStore = {
	locationId: string;
	name: string;
	chain?: string;
	city?: string;
	state?: string;
	zipCode?: string;
	address?: string;
};

export type EstimateLine = {
	input: string;
	status: 'ok' | 'skipped' | 'error';
	reason?: string;
	searchTerm?: string;
	grams?: number;
	count?: number;
	packagesNeeded?: number;
	unitPricePerGram?: number;
	unitPricePerCount?: number;
	estimate?: number;
	productId?: string;
	productDescription?: string;
	productSize?: string;
	productPrice?: number;
};

export type ProductOption = {
	productId: string;
	description: string;
	brand?: string;
	size: string;
	price: number;
	estimate: number;
	packagesNeeded?: number;
	unitPricePerGram?: number;
	unitPricePerCount?: number;
	mode: 'weight' | 'count' | string;
};

export type ProductOptionsResult = {
	input: string;
	searchTerm: string;
	grams?: number;
	count?: number;
	options: ProductOption[];
};

export type CostEstimate = {
	currency: string;
	total: number;
	locationId: string;
	lines: EstimateLine[];
	store?: EstimateStore | null;
};

export type StoreLookup = {
	store: EstimateStore | null;
	zip: string;
	user?: User;
};

export async function getEstimateStore(zip?: string): Promise<StoreLookup> {
	const query = zip ? `?zip=${encodeURIComponent(zip)}` : '';
	return api<StoreLookup>(`/api/estimates/store${query}`);
}

export async function saveEstimateStore(zip: string): Promise<StoreLookup> {
	return api<StoreLookup>('/api/estimates/store', {
		method: 'PUT',
		body: JSON.stringify({ zip })
	});
}

export async function estimateCost(
	lines: string[],
	opts?: {
		locationId?: string;
		zip?: string;
		overrides?: Array<{ input: string; productId: string; searchTerm?: string }>;
		pricing?: 'portion' | 'packages';
	}
) {
	return api<CostEstimate>('/api/estimates/cost', {
		method: 'POST',
		body: JSON.stringify({
			lines,
			locationId: opts?.locationId ?? '',
			zip: opts?.zip ?? '',
			overrides: opts?.overrides ?? [],
			pricing: opts?.pricing ?? 'portion'
		})
	});
}

export async function listEstimateProducts(
	line: string,
	opts?: {
		locationId?: string;
		zip?: string;
		searchTerm?: string;
		pricing?: 'portion' | 'packages';
	}
) {
	return api<ProductOptionsResult>('/api/estimates/products', {
		method: 'POST',
		body: JSON.stringify({
			line,
			searchTerm: opts?.searchTerm ?? '',
			locationId: opts?.locationId ?? '',
			zip: opts?.zip ?? '',
			pricing: opts?.pricing ?? 'portion'
		})
	});
}
