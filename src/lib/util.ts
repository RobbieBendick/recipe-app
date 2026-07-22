export function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function linesToList(value: string): string[] {
	return value
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);
}

export function listToLines(items: string[]): string {
	return items.join('\n');
}
