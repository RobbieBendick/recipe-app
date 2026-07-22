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

let token = $state<string | null>(null);
let user = $state<User | null>(null);
let ready = $state(false);

export function getToken(): string | null {
	return token;
}

export function getUser(): User | null {
	return user;
}

export function isAuthReady(): boolean {
	return ready;
}

export function isLoggedIn(): boolean {
	return Boolean(token);
}

export function hydrateAuth() {
	token = readStorage(TOKEN_KEY);
	const raw = readStorage(USER_KEY);
	if (raw) {
		try {
			user = JSON.parse(raw) as User;
		} catch {
			user = null;
		}
	} else {
		user = null;
	}
	ready = true;
}

export function setSession(nextToken: string, nextUser: User) {
	token = nextToken;
	user = nextUser;
	writeStorage(TOKEN_KEY, nextToken);
	writeStorage(USER_KEY, JSON.stringify(nextUser));
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
