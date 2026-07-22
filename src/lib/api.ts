import { PUBLIC_API_URL } from '$env/static/public';
import { clearSession, getToken } from '$lib/auth.svelte';
import { base } from '$app/paths';

const DEFAULT_API_URL = 'https://recipe-app-backend-bay.vercel.app';

export function apiBase(): string {
	const baseUrl = (PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, '');
	return baseUrl;
}

export class ApiError extends Error {
	status: number;

	constructor(status: number, message: string) {
		super(message);
		this.status = status;
	}
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const token = getToken();
	const response = await fetch(`${apiBase()}${path}`, {
		...init,
		headers: {
			Accept: 'application/json',
			...(init?.body ? { 'Content-Type': 'application/json' } : {}),
			...(token ? { Authorization: `Bearer ${token}` } : {}),
			...init?.headers
		}
	});

	if (response.status === 204) {
		return undefined as T;
	}

	const text = await response.text();
	let data: unknown = null;
	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = { error: text };
		}
	}

	if (!response.ok) {
		// Only wipe the stored session when a token was sent and rejected.
		// A 401 with no Authorization (e.g. race before hydrate) must not clear localStorage.
		if (response.status === 401 && token && typeof window !== 'undefined') {
			const onAuthPage =
				window.location.pathname.includes('/login') ||
				window.location.pathname.includes('/register');
			if (!onAuthPage) {
				clearSession();
				window.location.href = `${base}/login`;
			}
		}
		const message =
			typeof data === 'object' && data && 'error' in data
				? String((data as { error: unknown }).error)
				: `Request failed (${response.status})`;
		throw new ApiError(response.status, message);
	}

	return data as T;
}
