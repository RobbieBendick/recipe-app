import { api } from '$lib/api';
import type { AppNotification } from '$lib/types';

export async function listNotifications(): Promise<AppNotification[]> {
	return api<AppNotification[]>('/api/notifications');
}

export async function unreadNotificationCount(): Promise<number> {
	const res = await api<{ count: number }>('/api/notifications/unread-count');
	return res.count;
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
	return api<AppNotification>(`/api/notifications/${id}/read`, { method: 'POST' });
}

export async function markAllNotificationsRead(): Promise<void> {
	await api<void>('/api/notifications/read-all', { method: 'POST' });
}

export async function deleteNotification(id: string): Promise<void> {
	await api<void>(`/api/notifications/${id}`, { method: 'DELETE' });
}

export async function clearAllNotifications(): Promise<void> {
	await api<void>('/api/notifications', { method: 'DELETE' });
}
