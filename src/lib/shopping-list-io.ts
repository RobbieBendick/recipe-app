import type { ShoppingList } from '$lib/types';

export type ShoppingListExport = {
	version: 2;
	kind: 'shopping-list';
	title: string;
	emoji: string;
	items: string[];
	/** Recipe id → how many times that recipe was added to the list. */
	recipeCounts: Record<string, number>;
	exportedAt: string;
};

export type ShoppingListImport = {
	items: string[];
	recipeCounts: Record<string, number>;
};

const CODE_PREFIX = 'RSL2.';

export function toExportPayload(list: ShoppingList): ShoppingListExport {
	return {
		version: 2,
		kind: 'shopping-list',
		title: list.title,
		emoji: list.emoji || '',
		items: list.items.map((item) => item.text).filter((text) => text.trim()),
		recipeCounts: sanitizeRecipeCounts(list.recipeCounts),
		exportedAt: new Date().toISOString()
	};
}

/** Compact transferable code for copy/paste between lists. */
export function encodeShoppingList(list: ShoppingList): string {
	const json = JSON.stringify(toExportPayload(list));
	return CODE_PREFIX + utf8ToBase64(json);
}

export function sanitizeRecipeCounts(
	counts: Record<string, number> | null | undefined
): Record<string, number> {
	if (!counts) return {};
	const out: Record<string, number> = {};
	for (const [id, n] of Object.entries(counts)) {
		const key = id.trim();
		const count = Math.floor(Number(n));
		if (!key || !Number.isFinite(count) || count <= 0) continue;
		out[key] = count;
	}
	return out;
}

/** Add recipe counts (e.g. import into an existing list). */
export function mergeRecipeCounts(
	...parts: Array<Record<string, number> | null | undefined>
): Record<string, number> {
	const out: Record<string, number> = {};
	for (const part of parts) {
		for (const [id, n] of Object.entries(sanitizeRecipeCounts(part))) {
			out[id] = (out[id] ?? 0) + n;
		}
	}
	return out;
}

function utf8ToBase64(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function base64ToUtf8(encoded: string): string {
	const binary = atob(encoded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new TextDecoder().decode(bytes);
}

function payloadFromObject(data: Partial<ShoppingListExport> & { items?: unknown }): ShoppingListImport | null {
	if (!Array.isArray(data.items)) return null;
	const items = data.items
		.map((item) => (typeof item === 'string' ? item : String(item ?? '')))
		.map((text) => text.trim())
		.filter(Boolean);
	const recipeCounts =
		data.recipeCounts && typeof data.recipeCounts === 'object' && !Array.isArray(data.recipeCounts)
			? sanitizeRecipeCounts(data.recipeCounts as Record<string, number>)
			: {};
	return { items, recipeCounts };
}

/**
 * Decode a pasted export code (RSL2.…), raw JSON export, or plain text lines.
 */
export function parseShoppingListImport(raw: string): ShoppingListImport {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { items: [], recipeCounts: {} };
	}

	let candidate = trimmed;
	if (candidate.startsWith(CODE_PREFIX)) {
		candidate = candidate.slice(CODE_PREFIX.length).replace(/\s+/g, '');
		try {
			const json = base64ToUtf8(candidate);
			const data = JSON.parse(json) as Partial<ShoppingListExport>;
			const parsed = payloadFromObject(data);
			if (parsed) return parsed;
		} catch {
			return { items: [], recipeCounts: {} };
		}
	}

	// Bare base64 JSON (no prefix) — try decode then parse.
	if (!candidate.startsWith('{') && !candidate.includes('\n') && /^[A-Za-z0-9+/=\s]+$/.test(candidate)) {
		try {
			const json = base64ToUtf8(candidate.replace(/\s+/g, ''));
			if (json.trim().startsWith('{')) {
				const data = JSON.parse(json) as Partial<ShoppingListExport>;
				const parsed = payloadFromObject(data);
				if (parsed) return parsed;
			}
		} catch {
			/* fall through */
		}
	}

	if (trimmed.startsWith('{')) {
		try {
			const data = JSON.parse(trimmed) as Partial<ShoppingListExport>;
			const parsed = payloadFromObject(data);
			if (parsed) return parsed;
		} catch {
			/* fall through to line parse */
		}
	}

	return {
		items: trimmed
			.split(/\r?\n/)
			.map((line) => line.trim())
			.filter(Boolean),
		recipeCounts: {}
	};
}
