/** Parse, scale, and merge free-text recipe ingredient lines for shopping lists. */

export type ParsedIngredient = {
	quantity: number;
	unit: string;
	name: string;
	label: string;
};

const UNIT_ALIASES: Record<string, string> = {
	tsp: 'tsp',
	tsps: 'tsp',
	teaspoon: 'tsp',
	teaspoons: 'tsp',
	tbsp: 'tbsp',
	tbsps: 'tbsp',
	tablespoon: 'tbsp',
	tablespoons: 'tbsp',
	cup: 'cup',
	cups: 'cup',
	oz: 'oz',
	ounce: 'oz',
	ounces: 'oz',
	lb: 'lb',
	lbs: 'lb',
	pound: 'lb',
	pounds: 'lb',
	g: 'g',
	gram: 'g',
	grams: 'g',
	kg: 'kg',
	ml: 'ml',
	l: 'l',
	liter: 'l',
	litre: 'l',
	liters: 'l',
	litres: 'l',
	clove: 'clove',
	cloves: 'clove',
	pinch: 'pinch',
	pinches: 'pinch',
	can: 'can',
	cans: 'can',
	package: 'package',
	packages: 'package',
	pkg: 'package',
	slice: 'slice',
	slices: 'slice',
	bunch: 'bunch',
	bunches: 'bunch'
};

const UNIT_PATTERN = Object.keys(UNIT_ALIASES)
	.sort((a, b) => b.length - a.length)
	.join('|');

const QTY_PATTERN = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+\.\d+|\d+)`;
const SIZE_QTY_PATTERN = String.raw`(?:\d+\/\d+|\d+\.\d+|\d+)`;

function parseQuantity(raw: string): number {
	const trimmed = raw.trim().replace(/\s+/g, ' ');
	const mixed = trimmed.match(/^(\d+)\s+(\d+)\/(\d+)$/);
	if (mixed) {
		return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
	}
	const fraction = trimmed.match(/^(\d+)\/(\d+)$/);
	if (fraction) {
		return Number(fraction[1]) / Number(fraction[2]);
	}
	return Number(trimmed);
}

function stripLeadingEmoji(value: string): string {
	return value.replace(/^[\p{Extended_Pictographic}\uFE0F\u200D]+\s*/u, '').trim();
}

function normalizeName(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\s%-]/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Map irregular plurals → singular for merge keys. */
const IRREGULAR_SINGULAR: Record<string, string> = {
	leaves: 'leaf',
	loaves: 'loaf',
	potatoes: 'potato',
	tomatoes: 'tomato',
	avocadoes: 'avocado',
	avocados: 'avocado',
	berries: 'berry',
	cherries: 'cherry',
	strawberries: 'strawberry',
	blueberries: 'blueberry',
	raspberries: 'raspberry',
	blackberries: 'blackberry',
	peaches: 'peach',
	dishes: 'dish',
	radishes: 'radish'
};

const IRREGULAR_PLURAL: Record<string, string> = Object.fromEntries(
	Object.entries(IRREGULAR_SINGULAR).map(([plural, singular]) => [singular, plural])
);

function singularizeWord(word: string): string {
	const lower = word.toLowerCase();
	if (IRREGULAR_SINGULAR[lower]) return IRREGULAR_SINGULAR[lower];
	if (lower.length <= 2) return lower;
	if (lower.endsWith('ies') && lower.length > 4) return `${lower.slice(0, -3)}y`;
	if (/(?:ches|shes|sses|xes|zes)$/.test(lower)) return lower.slice(0, -2);
	if (lower.endsWith('oes') && lower.length > 4) return lower.slice(0, -2);
	if (lower.endsWith('s') && !lower.endsWith('ss') && !lower.endsWith('us')) {
		return lower.slice(0, -1);
	}
	return lower;
}

function pluralizeWord(word: string): string {
	const lower = word.toLowerCase();
	if (IRREGULAR_PLURAL[lower]) return IRREGULAR_PLURAL[lower];
	if (lower.length <= 1) return `${lower}s`;
	if (lower.endsWith('y') && lower.length > 1 && !/[aeiou]y$/i.test(lower)) {
		return `${lower.slice(0, -1)}ies`;
	}
	if (/(?:ch|sh|ss|x|z|o)$/.test(lower)) return `${lower}es`;
	if (lower.endsWith('s')) return lower;
	return `${lower}s`;
}

function matchCase(source: string, target: string): string {
	if (!source) return target;
	if (source === source.toUpperCase()) return target.toUpperCase();
	if (source[0] === source[0].toUpperCase()) {
		return target.charAt(0).toUpperCase() + target.slice(1);
	}
	return target;
}

/** Singularize the final word so "egg" / "eggs" share a merge key. */
function canonicalName(name: string): string {
	const parts = normalizeName(name).split(' ').filter(Boolean);
	if (!parts.length) return '';
	parts[parts.length - 1] = singularizeWord(parts[parts.length - 1]);
	return parts.join(' ');
}

/** Agree the display noun with quantity when there is no unit (count items). */
function agreeLabel(label: string, quantity: number, hasUnit: boolean): string {
	const cleaned = cleanLabel(label);
	if (!cleaned || hasUnit) return cleaned;

	const parts = cleaned.split(/\s+/);
	const last = parts[parts.length - 1];
	const singular = singularizeWord(last);
	const agreed = Math.abs(quantity - 1) < 0.001 ? singular : pluralizeWord(singular);
	parts[parts.length - 1] = matchCase(last, agreed);
	return parts.join(' ');
}

function normalizeUnit(value: string): string {
	const key = value.toLowerCase().replace(/\.$/, '');
	return UNIT_ALIASES[key] ?? key;
}

function cleanLabel(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

export function parseIngredientLine(line: string): ParsedIngredient {
	const cleaned = stripLeadingEmoji(line.trim());
	if (!cleaned) {
		return { quantity: 1, unit: '', name: '', label: '' };
	}

	// "32oz sugar", "2 cups flour", "3 1/2 cups sugar"
	const withUnit = cleaned.match(
		new RegExp(`^(${QTY_PATTERN})\\s*(${UNIT_PATTERN})\\b\\.?(?:\\s+of)?\\s+(.+)$`, 'i')
	);
	if (withUnit) {
		const label = cleanLabel(withUnit[3]);
		return {
			quantity: parseQuantity(withUnit[1]),
			unit: normalizeUnit(withUnit[2]),
			name: canonicalName(label),
			label
		};
	}

	// "2 32oz chocolate chips" → 2 × 32 oz
	const countTimesSize = cleaned.match(
		new RegExp(
			`^(\\d+(?:\\.\\d+)?)\\s+(${SIZE_QTY_PATTERN})\\s*(${UNIT_PATTERN})\\b\\.?(?:\\s+of)?\\s+(.+)$`,
			'i'
		)
	);
	if (countTimesSize) {
		const label = cleanLabel(countTimesSize[4]);
		return {
			quantity: parseQuantity(countTimesSize[1]) * parseQuantity(countTimesSize[2]),
			unit: normalizeUnit(countTimesSize[3]),
			name: canonicalName(label),
			label
		};
	}

	const qtyOnly = cleaned.match(new RegExp(`^(${QTY_PATTERN})\\s+(.+)$`, 'i'));
	if (qtyOnly) {
		const label = cleanLabel(qtyOnly[2]);
		return {
			quantity: parseQuantity(qtyOnly[1]),
			unit: '',
			name: canonicalName(label),
			label
		};
	}

	const label = cleanLabel(cleaned);
	return {
		quantity: 1,
		unit: '',
		name: canonicalName(label),
		label
	};
}

export function formatQuantity(value: number): string {
	if (!Number.isFinite(value)) return '1';
	const rounded = Math.round(value * 1000) / 1000;
	if (Number.isInteger(rounded)) return String(rounded);

	const denominators = [2, 3, 4, 8];
	for (const den of denominators) {
		const num = Math.round(rounded * den);
		if (Math.abs(num / den - rounded) < 0.001) {
			const whole = Math.floor(num / den);
			const rem = num % den;
			if (rem === 0) return String(whole);
			if (whole === 0) return `${rem}/${den}`;
			return `${whole} ${rem}/${den}`;
		}
	}

	return String(Number(rounded.toFixed(2)));
}

export function formatIngredient(item: ParsedIngredient): string {
	const rawLabel = item.label || item.name;
	if (!rawLabel) return '';
	const label = agreeLabel(rawLabel, item.quantity, Boolean(item.unit));
	const qty = formatQuantity(item.quantity);
	if (item.unit) return `${qty} ${item.unit} ${label}`;
	// Grocery names like "White Bread" should not become "1 White Bread".
	if (Math.abs(item.quantity - 1) < 0.001) return label;
	return `${qty} ${label}`;
}

function mergeKey(item: ParsedIngredient): string {
	return `${item.unit}::${item.name}`;
}

/** Scale ingredient lines by servings, then merge same name+unit into one line. */
export function aggregateIngredientLines(lines: string[], servings = 1): string[] {
	const scale = Math.max(0, servings);
	const totals = new Map<string, ParsedIngredient>();

	for (const line of lines) {
		const parsed = parseIngredientLine(line);
		if (!parsed.name) continue;
		const scaled: ParsedIngredient = {
			...parsed,
			quantity: parsed.quantity * scale
		};
		const key = mergeKey(scaled);
		const existing = totals.get(key);
		if (existing) {
			existing.quantity += scaled.quantity;
		} else {
			totals.set(key, { ...scaled });
		}
	}

	return [...totals.values()]
		.filter((item) => item.quantity > 0 && item.name)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(formatIngredient);
}

/** Merge many ingredient line lists (already scaled) into one aggregated list. */
export function mergeIngredientLists(lists: string[][]): string[] {
	return aggregateIngredientLines(lists.flat(), 1);
}

/**
 * Remove `remove` quantities from `base` by name+unit.
 * Leftover lines (manual extras) are returned; fully cancelled lines are dropped.
 */
export function subtractIngredientLists(base: string[], remove: string[]): string[] {
	const totals = new Map<string, ParsedIngredient>();

	for (const line of base) {
		const parsed = parseIngredientLine(line);
		if (!parsed.name) continue;
		const key = mergeKey(parsed);
		const existing = totals.get(key);
		if (existing) {
			existing.quantity += parsed.quantity;
		} else {
			totals.set(key, { ...parsed });
		}
	}

	for (const line of remove) {
		const parsed = parseIngredientLine(line);
		if (!parsed.name) continue;
		const key = mergeKey(parsed);
		const existing = totals.get(key);
		if (!existing) continue;
		existing.quantity -= parsed.quantity;
		if (existing.quantity <= 0.001) {
			totals.delete(key);
		}
	}

	return [...totals.values()]
		.filter((item) => item.quantity > 0 && item.name)
		.sort((a, b) => a.name.localeCompare(b.name))
		.map(formatIngredient);
}
