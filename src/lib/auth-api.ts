import { api } from '$lib/api';
import { setSession } from '$lib/auth.svelte';
import type { AuthResponse, User } from '$lib/types';

export async function register(email: string, password: string, name = '') {
	const res = await api<AuthResponse>('/api/auth/register', {
		method: 'POST',
		body: JSON.stringify({ email, password, name })
	});
	setSession(res.token, res.user);
	return res;
}

export async function login(email: string, password: string) {
	const res = await api<AuthResponse>('/api/auth/login', {
		method: 'POST',
		body: JSON.stringify({ email, password })
	});
	setSession(res.token, res.user);
	return res;
}

export async function loginWithGoogle(idToken: string) {
	const res = await api<AuthResponse>('/api/auth/google', {
		method: 'POST',
		body: JSON.stringify({ idToken })
	});
	setSession(res.token, res.user);
	return res;
}

export async function fetchMe(): Promise<User> {
	return api<User>('/api/auth/me');
}
