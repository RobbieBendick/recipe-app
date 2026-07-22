import { goto } from '$app/navigation';
import { base } from '$app/paths';
import type { User } from '$lib/types';

const TOKEN_KEY = 'recipe_app_token';
const USER_KEY = 'recipe_app_user';

function readStorage(key: string): string | null {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(key);
}

function writeStorage(key: string, value: string | null) {
	if (typeof localStorage === 'undefined') return;
	if (value == null) localStorage.removeItem(key);
	else localStorage.setItem(key, value);
}

function readStoredUser(): User | null {
	const raw = readStorage(USER_KEY);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as User;
	} catch {
		return null;
	}
}

// Restore immediately on the client so refresh doesn't look logged-out
// (and so early API calls don't fire without a token and wipe storage).
const browser = typeof localStorage !== 'undefined';
let token = $state<string | null>(browser ? readStorage(TOKEN_KEY) : null);
let user = $state<User | null>(browser ? readStoredUser() : null);
let ready = $state(browser);

export function getToken(): string | null {
	if (token) return token;
	const stored = readStorage(TOKEN_KEY);
	if (stored && !token) {
		token = stored;
	}
	return stored;
}

export function getUser(): User | null {
	return user;
}

export function isAuthReady(): boolean {
	return ready;
}

export function isLoggedIn(): boolean {
	return Boolean(getToken());
}

export function hydrateAuth() {
	token = readStorage(TOKEN_KEY);
	user = readStoredUser();
	ready = true;
}

export function setSession(nextToken: string, nextUser: User) {
	token = nextToken;
	user = nextUser;
	writeStorage(TOKEN_KEY, nextToken);
	writeStorage(USER_KEY, JSON.stringify(nextUser));
	ready = true;
}

export function updateUser(nextUser: User) {
	user = nextUser;
	writeStorage(USER_KEY, JSON.stringify(nextUser));
}

export function clearSession() {
	token = null;
	user = null;
	writeStorage(TOKEN_KEY, null);
	writeStorage(USER_KEY, null);
}

export function logout(redirect = true) {
	clearSession();
	if (redirect && typeof window !== 'undefined') {
		goto(`${base}/login`);
	}
}

export function authStore() {
	return {
		get token() {
			return token;
		},
		get user() {
			return user;
		},
		get ready() {
			return ready;
		},
		get loggedIn() {
			return Boolean(token);
		}
	};
}
