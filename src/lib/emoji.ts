/** Common food / kitchen emoji for quick picks */
export const FOOD_EMOJI = [
	'🍳',
	'🥗',
	'🍝',
	'🍕',
	'🌮',
	'🍔',
	'🍜',
	'🍲',
	'🥘',
	'🍛',
	'🍣',
	'🥪',
	'🥐',
	'🥞',
	'🧇',
	'🧁',
	'🍰',
	'🍪',
	'🥚',
	'🧈',
	'🥛',
	'🧀',
	'🍞',
	'🥖',
	'🫒',
	'🧄',
	'🧅',
	'🍋',
	'🍅',
	'🥑',
	'🌶️',
	'🥕',
	'🥦',
	'🌽',
	'🥔',
	'🍄',
	'🫘',
	'🍚',
	'🧂',
	'🍯',
	'🫙',
	'🛒',
	'📦',
	'🏠',
	'✨'
] as const;

/** Hand-drawn icons are stored as PNG data URLs in the emoji field. */
export function isCustomIcon(value: string | undefined | null): boolean {
	return Boolean(value?.trim().startsWith('data:image'));
}

export function displayEmoji(emoji: string | undefined | null, fallback = '🍽️'): string {
	const value = (emoji ?? '').trim();
	if (!value || isCustomIcon(value)) return fallback;
	return value;
}
