import { api } from '$lib/api';
import type { FriendRequests, Friendship, PublicUser } from '$lib/types';

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
