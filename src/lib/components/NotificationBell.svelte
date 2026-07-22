<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { acceptFriendRequest, declineFriendRequest } from '$lib/friends-api';
	import {
		clearAllNotifications,
		deleteNotification,
		listNotifications,
		markAllNotificationsRead,
		markNotificationRead,
		unreadNotificationCount
	} from '$lib/notifications-api';
	import { acceptRecipeShare, declineRecipeShare } from '$lib/recipes-api';
	import type { AppNotification } from '$lib/types';

	let open = $state(false);
	let unread = $state(0);
	let items = $state<AppNotification[]>([]);
	let loading = $state(false);
	let actionError = $state('');
	let actingId = $state('');
	let rootEl = $state<HTMLDivElement | null>(null);

	let pollTimer: ReturnType<typeof setInterval> | undefined;

	async function refreshCount() {
		try {
			unread = await unreadNotificationCount();
		} catch {
			/* ignore poll errors */
		}
	}

	async function loadList() {
		loading = true;
		actionError = '';
		try {
			items = await listNotifications();
			unread = items.filter((n) => !n.readAt).length;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to load notifications';
		} finally {
			loading = false;
		}
	}

	async function toggle() {
		open = !open;
		if (open) {
			await loadList();
		}
	}

	async function onMarkAll() {
		try {
			await markAllNotificationsRead();
			items = items.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }));
			unread = 0;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to mark all read';
		}
	}

	async function onClear(n: AppNotification) {
		actingId = n.id;
		actionError = '';
		try {
			await deleteNotification(n.id);
			items = items.filter((item) => item.id !== n.id);
			unread = items.filter((item) => !item.readAt).length;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to clear notification';
		} finally {
			actingId = '';
		}
	}

	async function onClearAll() {
		actionError = '';
		try {
			await clearAllNotifications();
			items = [];
			unread = 0;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to clear notifications';
		}
	}

	async function onAccept(n: AppNotification) {
		actingId = n.id;
		actionError = '';
		try {
			if (n.type === 'friend_request') {
				const friendshipId = n.data?.friendshipId;
				if (!friendshipId) return;
				await acceptFriendRequest(friendshipId);
				await deleteNotification(n.id);
				items = items.filter((item) => item.id !== n.id);
				unread = items.filter((item) => !item.readAt).length;
				dispatchFriendsChanged();
			} else if (n.type === 'recipe_share') {
				const shareId = n.data?.shareId;
				if (!shareId) return;
				const recipe = await acceptRecipeShare(shareId);
				items = items.filter((item) => item.id !== n.id);
				unread = items.filter((item) => !item.readAt).length;
				open = false;
				goto(`${base}/your-recipes/${recipe.id}`);
			}
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to accept';
		} finally {
			actingId = '';
		}
	}

	async function onDecline(n: AppNotification) {
		actingId = n.id;
		actionError = '';
		try {
			if (n.type === 'friend_request') {
				const friendshipId = n.data?.friendshipId;
				if (!friendshipId) return;
				await declineFriendRequest(friendshipId);
			} else if (n.type === 'recipe_share') {
				const shareId = n.data?.shareId;
				if (!shareId) return;
				await declineRecipeShare(shareId);
			} else {
				return;
			}
			await deleteNotification(n.id).catch(() => undefined);
			items = items.filter((item) => item.id !== n.id);
			unread = items.filter((item) => !item.readAt).length;
		} catch (e) {
			actionError = e instanceof Error ? e.message : 'Failed to decline';
		} finally {
			actingId = '';
		}
	}

	async function onOpenItem(n: AppNotification) {
		if (n.readAt) return;
		if (n.type === 'friend_request' || n.type === 'recipe_share') return;
		try {
			await markNotificationRead(n.id);
			items = items.map((item) =>
				item.id === n.id ? { ...item, readAt: item.readAt || new Date().toISOString() } : item
			);
			unread = items.filter((item) => !item.readAt).length;
		} catch {
			/* ignore */
		}
	}

	function dispatchFriendsChanged() {
		if (typeof window !== 'undefined') {
			window.dispatchEvent(new CustomEvent('friends:changed'));
		}
	}

	function onDocClick(e: MouseEvent) {
		if (!open || !rootEl) return;
		if (!rootEl.contains(e.target as Node)) {
			open = false;
		}
	}

	function formatTime(iso: string) {
		const d = new Date(iso);
		if (Number.isNaN(d.getTime())) return '';
		return d.toLocaleString(undefined, {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	function isPendingRequest(n: AppNotification) {
		if (n.readAt) return false;
		if (n.type === 'friend_request') return Boolean(n.data?.friendshipId);
		if (n.type === 'recipe_share') return Boolean(n.data?.shareId);
		return false;
	}

	onMount(() => {
		void refreshCount();
		pollTimer = setInterval(() => {
			void refreshCount();
		}, 30000);
		document.addEventListener('click', onDocClick);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		document.removeEventListener('click', onDocClick);
	});
</script>

<div class="bell" bind:this={rootEl}>
	<button
		type="button"
		class="bell__btn"
		aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
		aria-expanded={open}
		aria-haspopup="true"
		onclick={(e) => {
			e.stopPropagation();
			void toggle();
		}}
	>
		<span class="bell__ico" aria-hidden="true">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path
					d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<path d="M13.73 21a2 2 0 0 1-3.46 0" stroke-linecap="round" stroke-linejoin="round" />
			</svg>
		</span>
		{#if unread > 0}
			<span class="bell__badge">{unread > 99 ? '99+' : unread}</span>
		{/if}
	</button>

	{#if open}
		<div class="panel" role="dialog" aria-label="Notifications">
			<div class="panel__head">
				<h2>Notifications</h2>
				{#if items.length > 0}
					<div class="panel__actions">
						{#if unread > 0}
							<button type="button" class="panel__link" onclick={() => void onMarkAll()}>
								Mark all read
							</button>
						{/if}
						<button type="button" class="panel__link panel__link--danger" onclick={() => void onClearAll()}>
							Clear all
						</button>
					</div>
				{/if}
			</div>

			{#if actionError}
				<p class="panel__error" role="alert">{actionError}</p>
			{/if}

			{#if loading}
				<p class="panel__muted">Loading…</p>
			{:else if items.length === 0}
				<p class="panel__muted">No notifications yet.</p>
			{:else}
				<ul class="panel__list">
					{#each items as n (n.id)}
						<li class="item" class:item--unread={!n.readAt}>
							<div class="item__top">
								<button type="button" class="item__main" onclick={() => void onOpenItem(n)}>
									<span class="item__title">{n.title}</span>
									<span class="item__body">{n.body}</span>
									<span class="item__time">{formatTime(n.createdAt)}</span>
								</button>
								<button
									type="button"
									class="item__clear"
									aria-label="Clear notification"
									disabled={actingId === n.id}
									onclick={() => void onClear(n)}
								>
									×
								</button>
							</div>
							{#if isPendingRequest(n)}
								<div class="item__actions">
									<button
										type="button"
										class="btn btn--accept"
										disabled={actingId === n.id}
										onclick={() => void onAccept(n)}
									>
										Accept
									</button>
									<button
										type="button"
										class="btn btn--decline"
										disabled={actingId === n.id}
										onclick={() => void onDecline(n)}
									>
										Decline
									</button>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>

<style>
	.bell {
		position: relative;
	}

	.bell__btn {
		appearance: none;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		position: relative;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.65rem;
		opacity: 0.85;
		transition:
			opacity 0.2s var(--ease),
			background 0.2s var(--ease);
	}

	.bell__btn:hover,
	.bell__btn[aria-expanded='true'] {
		opacity: 1;
		background: var(--mist);
	}

	:global(.shell--home) .bell__btn:hover,
	:global(.shell--home) .bell__btn[aria-expanded='true'] {
		background: rgba(247, 251, 248, 0.16);
	}

	.bell__ico {
		display: inline-flex;
		line-height: 0;
	}

	.bell__badge {
		position: absolute;
		top: 0.1rem;
		right: 0.05rem;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.28rem;
		border-radius: 999px;
		background: #c43c3c;
		color: #fff;
		font-size: 0.65rem;
		font-weight: 700;
		line-height: 1.1rem;
		text-align: center;
		pointer-events: none;
	}

	.panel {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		width: min(22.5rem, calc(100vw - 2rem));
		max-height: min(28rem, 70vh);
		overflow: auto;
		background: #f7fbf8;
		border: 1.5px solid var(--line);
		border-radius: 0.9rem;
		box-shadow: 0 12px 40px rgba(19, 32, 24, 0.14);
		padding: 0.85rem 0.85rem 0.65rem;
		z-index: 40;
		color: var(--ink);
		animation: panel-in 0.22s var(--ease) both;
	}

	@media (max-width: 820px) {
		.panel {
			position: fixed;
			top: 4.25rem;
			right: 1rem;
			left: 1rem;
			width: auto;
			max-height: min(70vh, calc(100vh - 5.5rem));
		}
	}

	@keyframes panel-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.panel__head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.65rem;
		padding: 0 0.2rem;
	}

	.panel__head h2 {
		font-family: var(--font-display);
		font-size: 1.05rem;
		font-weight: 700;
		letter-spacing: -0.03em;
	}

	.panel__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.55rem 0.75rem;
	}

	.panel__link {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--leaf);
		cursor: pointer;
		padding: 0;
	}

	.panel__link:hover {
		text-decoration: underline;
	}

	.panel__link--danger {
		color: #8a2f2f;
	}

	.panel__muted,
	.panel__error {
		font-size: 0.9rem;
		padding: 0.5rem 0.2rem 0.75rem;
	}

	.panel__muted {
		color: var(--ink-soft);
	}

	.panel__error {
		color: #8a2f2f;
	}

	.panel__list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}

	.item {
		border-radius: 0.7rem;
		padding: 0.55rem 0.55rem 0.5rem;
		background: transparent;
	}

	.item--unread {
		background: rgba(27, 107, 69, 0.08);
	}

	.item__top {
		display: flex;
		align-items: flex-start;
		gap: 0.35rem;
	}

	.item__main {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		color: inherit;
		text-align: left;
		width: 100%;
		min-width: 0;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: 0;
	}

	.item__clear {
		appearance: none;
		border: none;
		background: transparent;
		color: var(--ink-soft);
		cursor: pointer;
		font-size: 1.25rem;
		line-height: 1;
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 0.4rem;
		flex-shrink: 0;
		opacity: 0.65;
	}

	.item__clear:hover {
		opacity: 1;
		background: rgba(19, 32, 24, 0.06);
		color: #8a2f2f;
	}

	.item__clear:disabled {
		opacity: 0.4;
		cursor: wait;
	}

	.item__title {
		font-weight: 650;
		font-size: 0.9rem;
	}

	.item__body {
		font-size: 0.84rem;
		color: var(--ink-soft);
		line-height: 1.35;
	}

	.item__time {
		font-size: 0.72rem;
		color: var(--ink-soft);
		opacity: 0.85;
		margin-top: 0.15rem;
	}

	.item__actions {
		display: flex;
		gap: 0.45rem;
		margin-top: 0.55rem;
	}

	.btn {
		appearance: none;
		border: none;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 650;
		padding: 0.4rem 0.7rem;
		border-radius: 0.5rem;
		cursor: pointer;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.btn--accept {
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn--decline {
		background: transparent;
		color: var(--ink-soft);
		border: 1.5px solid var(--line);
	}
</style>
