/** Persist chosen Kroger products per ingredient line (browser-local). */

export type ProductOverride = {
	productId: string;
	searchTerm?: string;
};

const PREFIX = 'estimate-product-overrides:v1:';

function storageKey(persistKey: string): string {
	return PREFIX + persistKey;
}

function lineKey(input: string): string {
	return input.trim().toLowerCase();
}

export function loadProductOverrides(persistKey: string): Record<string, ProductOverride> {
	if (!persistKey || typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(storageKey(persistKey));
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, ProductOverride>;
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed;
	} catch {
		return {};
	}
}

export function saveProductOverride(
	persistKey: string,
	input: string,
	override: ProductOverride
): void {
	if (!persistKey || typeof localStorage === 'undefined') return;
	const key = lineKey(input);
	if (!key || !override.productId) return;
	const all = loadProductOverrides(persistKey);
	all[key] = {
		productId: override.productId,
		searchTerm: override.searchTerm?.trim() || undefined
	};
	localStorage.setItem(storageKey(persistKey), JSON.stringify(all));
}

export function overridesForEstimate(
	persistKey: string,
	lines: string[]
): Array<{ input: string; productId: string; searchTerm?: string }> {
	const saved = loadProductOverrides(persistKey);
	const out: Array<{ input: string; productId: string; searchTerm?: string }> = [];
	for (const line of lines) {
		const o = saved[lineKey(line)];
		if (!o?.productId) continue;
		out.push({
			input: line,
			productId: o.productId,
			searchTerm: o.searchTerm
		});
	}
	return out;
}
