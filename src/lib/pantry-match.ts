import { parseIngredientLine } from '$lib/ingredients';
import type { PantryItem, Recipe } from '$lib/types';

export type IngredientMatch = {
  line: string;
  name: string;
  /** True only when pantry covers the needed amount (or presence for %-based staples). */
  have: boolean;
  needQty: number;
  haveQty: number;
  /** Extra context when partially stocked, e.g. "have 1". */
  note: string;
};

export type RecipePantryMatch = {
  recipe: Recipe;
  total: number;
  haveCount: number;
  missingCount: number;
  ratio: number;
  ingredients: IngredientMatch[];
};

type StockEntry = {
  name: string;
  /** Available count, or null when only %-full presence is known. */
  count: number | null;
  /** True when percent-unit item has any level left. */
  present: boolean;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function namesMatch(ingredient: string, pantry: string): boolean {
  if (!ingredient || !pantry) return false;
  if (ingredient === pantry) return true;

  const shorter = ingredient.length <= pantry.length ? ingredient : pantry;
  const longer = ingredient.length <= pantry.length ? pantry : ingredient;
  if (shorter.length < 3) return false;

  if (longer.includes(shorter)) {
    const re = new RegExp(`(?:^|\\s)${escapeRegExp(shorter)}(?:\\s|$)`);
    return re.test(longer);
  }
  return false;
}

function buildStock(items: PantryItem[]): StockEntry[] {
  const byName = new Map<string, StockEntry>();

  for (const item of items) {
    const amount = item.percent;
    const inStock = item.inStock || amount > 0;
    if (!inStock) continue;

    const name = parseIngredientLine(item.name).name;
    if (!name) continue;

    const existing = byName.get(name) ?? { name, count: null, present: false };

    if (item.unit === 'count') {
      existing.count = (existing.count ?? 0) + amount;
      existing.present = existing.count > 0;
    } else {
      existing.present = existing.present || amount > 0;
      // Percent staples don't give a usable count.
    }

    byName.set(name, existing);
  }

  return [...byName.values()];
}

function matchingStock(
  ingredientName: string,
  stock: StockEntry[],
): StockEntry[] {
  return stock.filter(entry => namesMatch(ingredientName, entry.name));
}

function evaluateIngredient(
  line: string,
  stock: StockEntry[],
): IngredientMatch {
  const parsed = parseIngredientLine(line);
  const name = parsed.name;
  const needQty =
    Number.isFinite(parsed.quantity) && parsed.quantity > 0
      ? parsed.quantity
      : 1;
  const hasUnit = Boolean(parsed.unit);

  if (!name) {
    return { line, name: '', have: false, needQty, haveQty: 0, note: '' };
  }

  const matches = matchingStock(name, stock);
  if (matches.length === 0) {
    return { line, name, have: false, needQty, haveQty: 0, note: '' };
  }

  const counted = matches.filter(m => m.count != null);
  const haveQty = counted.reduce((sum, m) => sum + (m.count ?? 0), 0);
  const anyPresent = matches.some(m => m.present || (m.count ?? 0) > 0);

  // Counted pantry items vs count-style recipe lines (no unit): compare amounts.
  if (!hasUnit && counted.length > 0) {
    const enough = haveQty + 1e-9 >= needQty;
    return {
      line,
      name,
      have: enough,
      needQty,
      haveQty,
      note: enough
        ? ''
        : haveQty > 0
          ? `have ${formatQty(haveQty)}, need ${formatQty(needQty - haveQty)}`
          : '',
    };
  }

  // Recipe asks for a measured unit, or pantry only has % level: presence is enough.
  return {
    line,
    name,
    have: anyPresent,
    needQty,
    haveQty: haveQty > 0 ? haveQty : anyPresent ? needQty : 0,
    note: '',
  };
}

function formatQty(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return String(Math.round(value * 100) / 100);
}

export function matchRecipesToPantry(
  recipes: Recipe[],
  pantryItems: PantryItem[],
): RecipePantryMatch[] {
  const stock = buildStock(pantryItems);
  if (stock.length === 0) return [];

  const scored: RecipePantryMatch[] = [];

  for (const recipe of recipes) {
    const lines = (recipe.ingredients ?? [])
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const ingredients = lines.map(line => evaluateIngredient(line, stock));
    const haveCount = ingredients.filter(entry => entry.have).length;
    const total = ingredients.length;
    const missingCount = total - haveCount;
    const anyProgress = haveCount > 0 || ingredients.some(i => Boolean(i.note));
    if (!anyProgress) continue;

    scored.push({
      recipe,
      total,
      haveCount,
      missingCount,
      ratio: haveCount / total,
      ingredients,
    });
  }

  return scored.sort((a, b) => {
    if (b.ratio !== a.ratio) return b.ratio - a.ratio;
    if (b.haveCount !== a.haveCount) return b.haveCount - a.haveCount;
    if (a.missingCount !== b.missingCount)
      return a.missingCount - b.missingCount;
    return a.recipe.title.localeCompare(b.recipe.title);
  });
}

/** Fully stocked recipes. */
export function readyRecipes(
  matches: RecipePantryMatch[],
): RecipePantryMatch[] {
  return matches.filter(m => m.missingCount === 0);
}

/**
 * Nearly complete: missing a little, but not empty-handed.
 * Prefer missing ≤ 2, or at least 60% covered.
 */
export function almostRecipes(
  matches: RecipePantryMatch[],
): RecipePantryMatch[] {
  return matches.filter(
    m =>
      m.missingCount > 0 &&
      (m.missingCount <= 2 ||
        m.ratio >= 0.6 ||
        m.ingredients.some(i => i.note)),
  );
}
