import type { PublicUser } from '$lib/types';

export type PantryNavPref = {
	enabled: boolean;
	friendUserId: string;
	friendLabel: string;
};

const KEY_PREFIX = 'recipe_app_pantry_nav:';

let enabled = $state(false);
let friendUserId = $state('');
let friendLabel = $state('');
let loadedForUser = $state('');

function storageKey(userId: string) {
	return KEY_PREFIX + userId;
}

function readPref(userId: string): PantryNavPref {
	if (typeof localStorage === 'undefined' || !userId) {
		return { enabled: false, friendUserId: '', friendLabel: '' };
	}
	try {
		const raw = localStorage.getItem(storageKey(userId));
		if (!raw) return { enabled: false, friendUserId: '', friendLabel: '' };
		const parsed = JSON.parse(raw) as Partial<PantryNavPref>;
		return {
			enabled: Boolean(parsed.enabled && parsed.friendUserId),
			friendUserId: typeof parsed.friendUserId === 'string' ? parsed.friendUserId : '',
			friendLabel: typeof parsed.friendLabel === 'string' ? parsed.friendLabel : ''
		};
	} catch {
		return { enabled: false, friendUserId: '', friendLabel: '' };
	}
}

function writePref(userId: string, pref: PantryNavPref) {
	if (typeof localStorage === 'undefined' || !userId) return;
	localStorage.setItem(storageKey(userId), JSON.stringify(pref));
}

export function pantryNavStore() {
	return {
		get enabled() {
			return enabled;
		},
		get friendUserId() {
			return friendUserId;
		},
		get friendLabel() {
			return friendLabel;
		},
		get loadedForUser() {
			return loadedForUser;
		}
	};
}

export function hydratePantryNavPref(userId: string | null | undefined) {
	if (!userId) {
		enabled = false;
		friendUserId = '';
		friendLabel = '';
		loadedForUser = '';
		return;
	}
	const pref = readPref(userId);
	enabled = pref.enabled;
	friendUserId = pref.friendUserId;
	friendLabel = pref.friendLabel;
	loadedForUser = userId;
}

export function setPantryNavPref(
	userId: string,
	next: { enabled: boolean; friend?: PublicUser | null }
) {
	const label = next.friend
		? next.friend.nickname?.trim() || next.friend.name?.trim() || next.friend.email
		: '';
	const pref: PantryNavPref = {
		enabled: Boolean(next.enabled && next.friend?.id),
		friendUserId: next.enabled && next.friend?.id ? next.friend.id : '',
		friendLabel: next.enabled && next.friend ? label : ''
	};
	writePref(userId, pref);
	enabled = pref.enabled;
	friendUserId = pref.friendUserId;
	friendLabel = pref.friendLabel;
	loadedForUser = userId;
}

export function clearPantryNavPref(userId: string) {
	setPantryNavPref(userId, { enabled: false, friend: null });
}

export function friendDisplayLabel(u: PublicUser) {
	return u.nickname?.trim() || u.name?.trim() || u.email;
}
