<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { authStore } from '$lib/auth.svelte';
	import {
		acceptFriendRequest,
		declineFriendRequest,
		getOrCreateSharedList,
		getOrCreateSharedPantry,
		listFriendRequests,
		listFriends,
		removeFriend,
		sendFriendRequest,
		setFriendNickname
	} from '$lib/friends-api';
	import {
		clearPantryNavPref,
		pantryNavStore,
		setPantryNavPref
	} from '$lib/pantry-nav-pref.svelte';
	import { pageTitle } from '$lib/site';
	import type { Friendship, PublicUser } from '$lib/types';

	const auth = authStore();
	const pantryNav = pantryNavStore();

	let friends = $state<PublicUser[]>([]);
	let incoming = $state<Friendship[]>([]);
	let outgoing = $state<Friendship[]>([]);
	let ready = $state(false);
	let error = $state('');
	let email = $state('');
	let sending = $state(false);
	let sendMsg = $state('');
	let actingId = $state('');
	let editingNicknameId = $state('');
	let nicknameDraft = $state('');
	let menuOpenId = $state('');

	function closeMenu() {
		menuOpenId = '';
	}

	function toggleMenu(friendId: string, e: MouseEvent) {
		e.stopPropagation();
		menuOpenId = menuOpenId === friendId ? '' : friendId;
	}

	function onDocClick(e: MouseEvent) {
		if (!menuOpenId) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest(`[data-friend-menu="${menuOpenId}"]`)) return;
		closeMenu();
	}

	async function load() {
		error = '';
		try {
			const [f, reqs] = await Promise.all([listFriends(), listFriendRequests()]);
			friends = f;
			incoming = reqs.incoming;
			outgoing = reqs.outgoing;
			if (
				auth.user?.id &&
				pantryNav.enabled &&
				pantryNav.friendUserId &&
				!f.some((friend) => friend.id === pantryNav.friendUserId)
			) {
				clearPantryNavPref(auth.user.id);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load friends';
		} finally {
			ready = true;
		}
	}

	async function onSend(e: Event) {
		e.preventDefault();
		sending = true;
		sendMsg = '';
		error = '';
		try {
			await sendFriendRequest(email);
			sendMsg = `Friend request sent to ${email.trim()}`;
			email = '';
			await load();
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send request';
		} finally {
			sending = false;
		}
	}

	async function onAccept(id: string) {
		actingId = id;
		error = '';
		try {
			await acceptFriendRequest(id);
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to accept';
		} finally {
			actingId = '';
		}
	}

	async function onDecline(id: string) {
		actingId = id;
		error = '';
		try {
			await declineFriendRequest(id);
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to decline';
		} finally {
			actingId = '';
		}
	}

	function startEditNickname(friend: PublicUser) {
		closeMenu();
		editingNicknameId = friend.id;
		nicknameDraft = friend.nickname?.trim() || '';
	}

	function cancelEditNickname() {
		editingNicknameId = '';
		nicknameDraft = '';
	}

	async function saveNickname(friend: PublicUser) {
		actingId = `nick:${friend.id}`;
		error = '';
		try {
			const updated = await setFriendNickname(friend.id, nicknameDraft);
			friends = friends.map((f) => (f.id === friend.id ? { ...f, nickname: updated.nickname || '' } : f));
			if (auth.user?.id && pantryNav.enabled && pantryNav.friendUserId === friend.id) {
				setPantryNavPref(auth.user.id, {
					enabled: true,
					friend: { ...friend, nickname: updated.nickname || '' }
				});
			}
			editingNicknameId = '';
			nicknameDraft = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save nickname';
		} finally {
			actingId = '';
		}
	}

	async function onSharedList(friend: PublicUser) {
		closeMenu();
		actingId = `share:${friend.id}`;
		error = '';
		try {
			const list = await getOrCreateSharedList(friend.id);
			goto(`${base}/shopping-lists/${list.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open shared list';
			actingId = '';
		}
	}

	async function onSharedPantry(friend: PublicUser) {
		closeMenu();
		actingId = `pantry:${friend.id}`;
		error = '';
		try {
			const pantry = await getOrCreateSharedPantry(friend.id);
			goto(`${base}/pantry?shared=${pantry.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to open shared pantry';
			actingId = '';
		}
	}

	async function onRemove(userId: string, labelText: string) {
		closeMenu();
		if (!confirm(`Remove ${labelText} from your friends?`)) return;
		actingId = userId;
		error = '';
		try {
			await removeFriend(userId);
			await load();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove friend';
		} finally {
			actingId = '';
		}
	}

	function label(u: PublicUser) {
		return u.nickname?.trim() || u.name?.trim() || u.email;
	}

	function initial(u: PublicUser) {
		return (u.nickname || u.name || u.email || '?').slice(0, 1).toUpperCase();
	}

	function onFriendsChanged() {
		void load();
	}

	onMount(() => {
		void load();
		window.addEventListener('friends:changed', onFriendsChanged);
		document.addEventListener('click', onDocClick);
	});

	onDestroy(() => {
		window.removeEventListener('friends:changed', onFriendsChanged);
		document.removeEventListener('click', onDocClick);
	});
</script>

<svelte:head>
	<title>{pageTitle('Friends')}</title>
</svelte:head>

<main class="page">
	<header class="intro">
		<h1>Friends</h1>
		<p class="lede">Send requests by email, manage pending invites, and keep your friends list here.</p>
	</header>

	<section class="card" aria-labelledby="invite-heading">
		<h2 id="invite-heading">Add a friend</h2>
		<form class="invite" onsubmit={onSend}>
			<label class="sr" for="friend-email">Friend’s email</label>
			<input
				id="friend-email"
				type="email"
				placeholder="friend@example.com"
				bind:value={email}
				required
				autocomplete="email"
			/>
			<button type="submit" class="btn" disabled={sending || !email.trim()}>
				{sending ? 'Sending…' : 'Send request'}
			</button>
		</form>
		{#if sendMsg}
			<p class="ok" role="status">{sendMsg}</p>
		{/if}
	</section>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	{#if !ready}
		<p class="muted">Loading…</p>
	{:else}
		{#if incoming.length > 0}
			<section class="section" aria-labelledby="incoming-heading">
				<h2 id="incoming-heading">Incoming requests</h2>
				<ul class="list">
					{#each incoming as req (req.id)}
						<li class="row">
							{#if req.otherUser}
								<span class="avatar" aria-hidden="true">
									{#if req.otherUser.avatarUrl}
										<img src={req.otherUser.avatarUrl} alt="" width="40" height="40" referrerpolicy="no-referrer" />
									{:else}
										<span class="avatar__fallback">{initial(req.otherUser)}</span>
									{/if}
								</span>
								<span class="row__text">
									<span class="row__title">{label(req.otherUser)}</span>
									<span class="row__meta">{req.otherUser.email}</span>
								</span>
							{/if}
							<span class="row__actions">
								<button
									type="button"
									class="btn"
									disabled={actingId === req.id}
									onclick={() => void onAccept(req.id)}
								>
									Accept
								</button>
								<button
									type="button"
									class="btn btn--ghost"
									disabled={actingId === req.id}
									onclick={() => void onDecline(req.id)}
								>
									Decline
								</button>
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if outgoing.length > 0}
			<section class="section" aria-labelledby="outgoing-heading">
				<h2 id="outgoing-heading">Sent requests</h2>
				<ul class="list">
					{#each outgoing as req (req.id)}
						<li class="row">
							{#if req.otherUser}
								<span class="avatar" aria-hidden="true">
									{#if req.otherUser.avatarUrl}
										<img src={req.otherUser.avatarUrl} alt="" width="40" height="40" referrerpolicy="no-referrer" />
									{:else}
										<span class="avatar__fallback">{initial(req.otherUser)}</span>
									{/if}
								</span>
								<span class="row__text">
									<span class="row__title">{label(req.otherUser)}</span>
									<span class="row__meta">Pending · {req.otherUser.email}</span>
								</span>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="section" aria-labelledby="friends-heading">
			<h2 id="friends-heading">Your friends</h2>
			{#if friends.length === 0}
				<div class="empty" role="status">
					<p>No friends yet. Send a request using someone’s account email.</p>
				</div>
			{:else}
				<ul class="list">
					{#each friends as friend (friend.id)}
						<li class="row row--friend">
							<span class="avatar" aria-hidden="true">
								{#if friend.avatarUrl}
									<img src={friend.avatarUrl} alt="" width="40" height="40" referrerpolicy="no-referrer" />
								{:else}
									<span class="avatar__fallback">{initial(friend)}</span>
								{/if}
							</span>
							<span class="row__text">
								{#if editingNicknameId === friend.id}
									<label class="sr" for="nick-{friend.id}">Nickname</label>
									<input
										id="nick-{friend.id}"
										class="nick-input"
										type="text"
										placeholder="Nickname"
										bind:value={nicknameDraft}
										maxlength="60"
									/>
									<span class="row__meta">{friend.name?.trim() || friend.email}</span>
								{:else}
									<span class="row__title">{label(friend)}</span>
									<span class="row__meta">
										{#if friend.nickname?.trim()}
											{friend.name?.trim() || friend.email}
										{:else}
											{friend.email}
										{/if}
									</span>
								{/if}
							</span>
							<span class="row__actions">
								{#if editingNicknameId === friend.id}
									<button
										type="button"
										class="btn"
										disabled={actingId === `nick:${friend.id}`}
										onclick={() => void saveNickname(friend)}
									>
										{actingId === `nick:${friend.id}` ? 'Saving…' : 'Save'}
									</button>
									<button
										type="button"
										class="btn btn--ghost"
										disabled={actingId === `nick:${friend.id}`}
										onclick={cancelEditNickname}
									>
										Cancel
									</button>
								{:else}
									<div class="menu" data-friend-menu={friend.id}>
										<button
											type="button"
											class="menu__trigger"
											aria-label="Friend actions for {label(friend)}"
											aria-expanded={menuOpenId === friend.id}
											aria-haspopup="menu"
											disabled={Boolean(actingId)}
											onclick={(e) => toggleMenu(friend.id, e)}
										>
											<span aria-hidden="true">⋯</span>
										</button>
										{#if menuOpenId === friend.id}
											<div class="menu__panel" role="menu">
												<button
													type="button"
													class="menu__item"
													role="menuitem"
													disabled={actingId === `share:${friend.id}`}
													onclick={() => void onSharedList(friend)}
												>
													{actingId === `share:${friend.id}` ? 'Opening…' : 'Shared list'}
												</button>
												<button
													type="button"
													class="menu__item"
													role="menuitem"
													disabled={actingId === `pantry:${friend.id}`}
													onclick={() => void onSharedPantry(friend)}
												>
													{actingId === `pantry:${friend.id}` ? 'Opening…' : 'Shared pantry'}
												</button>
												<button
													type="button"
													class="menu__item"
													role="menuitem"
													onclick={() => startEditNickname(friend)}
												>
													Nickname
												</button>
												<button
													type="button"
													class="menu__item menu__item--danger"
													role="menuitem"
													disabled={actingId === friend.id}
													onclick={() => void onRemove(friend.id, label(friend))}
												>
													Remove
												</button>
											</div>
										{/if}
									</div>
								{/if}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>

<style>
	.page {
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		max-width: 40rem;
		animation: rise 0.7s var(--ease) both;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.intro {
		margin-bottom: 1.75rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin-bottom: 0.55rem;
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.08rem;
		max-width: 42ch;
	}

	.card {
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.5);
		border-radius: 1rem;
		padding: 1.15rem 1.2rem 1.25rem;
		margin-bottom: 1.75rem;
	}

	.card h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.75rem;
	}

	.invite {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.invite input {
		flex: 1 1 12rem;
		min-width: 0;
		font: inherit;
		padding: 0.65rem 0.8rem;
		border-radius: 0.65rem;
		border: 1.5px solid var(--line);
		background: #fff;
		color: var(--ink);
	}

	.invite input:focus {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 1px;
	}

	.btn {
		appearance: none;
		border: none;
		font: inherit;
		font-weight: 650;
		font-size: 0.92rem;
		padding: 0.6rem 0.95rem;
		border-radius: 0.65rem;
		background: var(--leaf);
		color: #f7fbf8;
		cursor: pointer;
		white-space: nowrap;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.btn--ghost {
		background: transparent;
		color: var(--ink-soft);
		border: 1.5px solid var(--line);
	}

	.ok {
		margin-top: 0.65rem;
		font-size: 0.9rem;
		color: var(--leaf-deep);
	}

	.error {
		color: #8a2f2f;
		margin-bottom: 1rem;
	}

	.muted {
		color: var(--ink-soft);
	}

	.section {
		margin-bottom: 2rem;
	}

	.section h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.85rem;
	}

	.list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.7rem 0.8rem;
		border-radius: 0.85rem;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.45);
	}

	.row--friend {
		flex-wrap: nowrap;
	}

	.menu {
		position: relative;
		flex-shrink: 0;
	}

	.menu__trigger {
		appearance: none;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.7);
		color: var(--ink-soft);
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 0.65rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
		transition:
			background 0.2s var(--ease),
			border-color 0.2s var(--ease),
			color 0.2s var(--ease);
	}

	.menu__trigger:hover:not(:disabled),
	.menu__trigger[aria-expanded='true'] {
		background: rgba(27, 107, 69, 0.1);
		border-color: rgba(27, 107, 69, 0.28);
		color: var(--leaf-deep);
	}

	.menu__trigger:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.menu__panel {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		z-index: 8;
		min-width: 11.5rem;
		padding: 0.35rem;
		background: #f7fbf8;
		border: 1.5px solid var(--line);
		border-radius: 0.75rem;
		box-shadow: 0 12px 28px rgba(19, 32, 24, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		animation: menu-in 0.18s var(--ease) both;
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.menu__item {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: left;
		padding: 0.55rem 0.7rem;
		border-radius: 0.5rem;
		color: var(--ink);
		cursor: pointer;
		width: 100%;
	}

	.menu__item:hover:not(:disabled) {
		background: rgba(27, 107, 69, 0.1);
		color: var(--leaf-deep);
	}

	.menu__item:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.menu__item--danger {
		color: #8a2f2f;
	}

	.menu__item--danger:hover:not(:disabled) {
		background: rgba(180, 58, 58, 0.1);
		color: #8a2f2f;
	}

	.nick-input {
		font: inherit;
		font-weight: 650;
		padding: 0.4rem 0.55rem;
		border-radius: 0.5rem;
		border: 1.5px solid var(--line);
		background: #fff;
		color: var(--ink);
		width: 100%;
		max-width: 14rem;
	}

	.nick-input:focus {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 1px;
	}

	.avatar {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: rgba(27, 107, 69, 0.12);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar__fallback {
		font-weight: 700;
		font-size: 0.95rem;
		color: var(--leaf-deep);
	}

	.row__text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.row__title {
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row__meta {
		font-size: 0.82rem;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		flex-shrink: 0;
	}

	.empty {
		border: 1.5px dashed var(--line);
		border-radius: 0.85rem;
		padding: 1.25rem;
		color: var(--ink-soft);
	}

	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}
</style>
