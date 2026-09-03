import { api } from '$lib/api';
import type { FriendRequests, Friendship, PublicUser, SharedPantry, ShoppingList } from '$lib/types';

export async function listFriends(): Promise<PublicUser[]> {
	return api<PublicUser[]>('/api/friends');
}

export async function listFriendRequests(): Promise<FriendRequests> {
	return api<FriendRequests>('/api/friends/requests');
}

export async function sendFriendRequest(email: string): Promise<Friendship> {
	return api<Friendship>('/api/friends/requests', {
		method: 'POST',
		body: JSON.stringify({ email })
	});
}

export async function acceptFriendRequest(id: string): Promise<Friendship> {
	return api<Friendship>(`/api/friends/requests/${id}/accept`, { method: 'POST' });
}

export async function declineFriendRequest(id: string): Promise<void> {
	await api<void>(`/api/friends/requests/${id}/decline`, { method: 'POST' });
}

export async function removeFriend(userId: string): Promise<void> {
	await api<void>(`/api/friends/${userId}`, { method: 'DELETE' });
}

export async function getOrCreateSharedList(friendUserId: string): Promise<ShoppingList> {
	return api<ShoppingList>(`/api/friends/${friendUserId}/shared-list`);
}

export async function getOrCreateSharedPantry(friendUserId: string): Promise<SharedPantry> {
	return api<SharedPantry>(`/api/friends/${friendUserId}/shared-pantry`);
}

export async function setFriendNickname(friendUserId: string, nickname: string): Promise<PublicUser> {
	return api<PublicUser>(`/api/friends/${friendUserId}/nickname`, {
		method: 'PUT',
		body: JSON.stringify({ nickname })
	});
}
