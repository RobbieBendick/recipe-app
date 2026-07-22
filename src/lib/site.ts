export const SITE_NAME = 'recipes';

export const DEFAULT_TITLE = `${SITE_NAME} · your kitchen, collected`;

/** Build a browser title: "Part · Part · recipes" */
export function pageTitle(...parts: string[]): string {
	return [...parts, SITE_NAME].join(' · ');
}
