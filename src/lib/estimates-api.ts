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
	grams?: number;
	count?: number;
	unitPricePerGram?: number;
	unitPricePerCount?: number;
	estimate?: number;
	productDescription?: string;
	productSize?: string;
	productPrice?: number;
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

export async function estimateCost(lines: string[], opts?: { locationId?: string; zip?: string }) {
	return api<CostEstimate>('/api/estimates/cost', {
		method: 'POST',
		body: JSON.stringify({
			lines,
			locationId: opts?.locationId ?? '',
			zip: opts?.zip ?? ''
		})
	});
}
