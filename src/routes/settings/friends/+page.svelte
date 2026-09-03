<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { authStore } from '$lib/auth.svelte';
	import { listFriends } from '$lib/friends-api';
	import {
		clearPantryNavPref,
		friendDisplayLabel,
		pantryNavStore,
		setPantryNavPref
	} from '$lib/pantry-nav-pref.svelte';
	import { pageTitle } from '$lib/site';
	import type { PublicUser } from '$lib/types';

	const auth = authStore();
	const pantryNav = pantryNavStore();

	let friends = $state<PublicUser[]>([]);
	let ready = $state(false);
	let error = $state('');

	let navShortcutOn = $state(false);
	let friendQuery = $state('');
	let friendPickerOpen = $state(false);
	let selectedFriend = $state<PublicUser | null>(null);
	let navMsg = $state('');

	const friendMatches = $derived.by(() => {
		const q = friendQuery.trim().toLowerCase();
		if (!q) return friends.slice(0, 8);
		return friends
			.filter((f) => {
				const hay = [f.nickname, f.name, f.email].filter(Boolean).join(' ').toLowerCase();
				return hay.includes(q);
			})
			.slice(0, 8);
	});

	function syncNavShortcutFromPref(list: PublicUser[]) {
		navShortcutOn = pantryNav.enabled;
		if (pantryNav.enabled && pantryNav.friendUserId) {
			const found = list.find((f) => f.id === pantryNav.friendUserId) ?? null;
			selectedFriend = found;
			friendQuery = found ? friendDisplayLabel(found) : pantryNav.friendLabel;
			if (!found && auth.user?.id) {
				clearPantryNavPref(auth.user.id);
				navShortcutOn = false;
				selectedFriend = null;
				friendQuery = '';
			}
		} else {
			selectedFriend = null;
			friendQuery = '';
		}
	}

	function onToggleNavShortcut() {
		navMsg = '';
		navShortcutOn = !navShortcutOn;
		if (!navShortcutOn) {
			selectedFriend = null;
			friendQuery = '';
			friendPickerOpen = false;
			if (auth.user?.id) clearPantryNavPref(auth.user.id);
			navMsg = 'Navbar Pantry opens your personal pantry again.';
			return;
		}
		friendPickerOpen = true;
	}

	function pickFriendForNav(friend: PublicUser) {
		selectedFriend = friend;
		friendQuery = friendDisplayLabel(friend);
		friendPickerOpen = false;
		navMsg = '';
		if (auth.user?.id) {
			setPantryNavPref(auth.user.id, { enabled: true, friend });
			navMsg = `Navbar Pantry now opens your shared pantry with ${friendDisplayLabel(friend)}.`;
		}
	}

	function onFriendQueryInput() {
		friendPickerOpen = true;
		selectedFriend = null;
		navMsg = '';
		if (auth.user?.id && navShortcutOn) {
			clearPantryNavPref(auth.user.id);
			navShortcutOn = true;
		}
	}

	function tryExactFriendMatch() {
		const q = friendQuery.trim().toLowerCase();
		if (!q || !navShortcutOn) return;
		const exact = friends.find((f) => friendDisplayLabel(f).toLowerCase() === q);
		if (exact) pickFriendForNav(exact);
	}

	onMount(async () => {
		try {
			friends = await listFriends();
			syncNavShortcutFromPref(friends);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load friends';
		} finally {
			ready = true;
		}
	});
</script>

<svelte:head>
	<title>{pageTitle('Friends settings')}</title>
</svelte:head>

<main class="page">
	<p class="eyebrow">
		<a href="{base}/friends">Friends</a>
		<span class="eyebrow__sep" aria-hidden="true">›</span>
		<span>Friends settings</span>
	</p>
	<header class="intro">
		<h1>Friends settings</h1>
		<p class="lede">Controls for how friends connect to the rest of the app.</p>
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<section class="card" aria-labelledby="nav-pantry-heading">
		<h2 id="nav-pantry-heading">Navbar Pantry shortcut</h2>
		<p class="card__lede">
			Optionally send the Pantry nav button straight to a friend’s shared pantry.
		</p>

		{#if !ready}
			<p class="muted">Loading friends…</p>
		{:else if friends.length === 0}
			<p class="muted">
				Add a friend first on the <a class="text-link" href="{base}/friends">Friends</a> page.
			</p>
		{:else}
			<label class="check">
				<input type="checkbox" checked={navShortcutOn} onchange={onToggleNavShortcut} />
				<span>Route navbar Pantry to a shared pantry</span>
			</label>
			{#if navShortcutOn}
				<div class="picker">
					<label class="sr" for="nav-friend-query">Friend</label>
					<input
						id="nav-friend-query"
						class="picker__input"
						type="text"
						placeholder="Type a friend’s name or nickname"
						autocomplete="off"
						bind:value={friendQuery}
						oninput={onFriendQueryInput}
						onfocus={() => (friendPickerOpen = true)}
						onblur={() => {
							setTimeout(() => {
								friendPickerOpen = false;
								tryExactFriendMatch();
							}, 150);
						}}
						onkeydown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								if (friendMatches[0]) pickFriendForNav(friendMatches[0]);
							}
						}}
					/>
					{#if friendPickerOpen && friendMatches.length > 0}
						<ul class="picker__list" role="listbox">
							{#each friendMatches as friend (friend.id)}
								<li>
									<button
										type="button"
										class="picker__option"
										class:picker__option--active={selectedFriend?.id === friend.id}
										onclick={() => pickFriendForNav(friend)}
									>
										<span class="picker__name">{friendDisplayLabel(friend)}</span>
										<span class="picker__email">{friend.email}</span>
									</button>
								</li>
							{/each}
						</ul>
					{:else if friendPickerOpen && friendQuery.trim() && friendMatches.length === 0}
						<p class="picker__empty">No friends match that name.</p>
					{/if}
				</div>
				{#if selectedFriend}
					<p class="ok" role="status">Selected: {friendDisplayLabel(selectedFriend)}</p>
				{/if}
			{/if}
			{#if navMsg}
				<p class="ok" role="status">{navMsg}</p>
			{/if}
		{/if}
	</section>
</main>

<style>
	.page {
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		max-width: 36rem;
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

	.eyebrow {
		font-size: 0.92rem;
		margin: 0 0 0.85rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--ink-soft);
	}

	.eyebrow a {
		color: var(--leaf);
		font-weight: 600;
		text-decoration: none;
	}

	.eyebrow__sep {
		opacity: 0.55;
	}

	.intro {
		margin-bottom: 1.5rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin-bottom: 0.45rem;
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.05rem;
	}

	.card {
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.5);
		border-radius: 1rem;
		padding: 1.2rem 1.25rem 1.3rem;
	}

	.card h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.15rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.45rem;
	}

	.card__lede {
		color: var(--ink-soft);
		font-size: 0.95rem;
		margin-bottom: 0.85rem;
		line-height: 1.4;
	}

	.check {
		display: flex;
		align-items: flex-start;
		gap: 0.55rem;
		font-size: 0.95rem;
		font-weight: 550;
		cursor: pointer;
		margin-bottom: 0.75rem;
	}

	.check input {
		margin-top: 0.2rem;
		accent-color: var(--leaf);
	}

	.picker {
		position: relative;
		margin-bottom: 0.35rem;
	}

	.picker__input {
		width: 100%;
		font: inherit;
		padding: 0.65rem 0.8rem;
		border-radius: 0.65rem;
		border: 1.5px solid var(--line);
		background: #fff;
		color: var(--ink);
	}

	.picker__input:focus {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 1px;
	}

	.picker__list {
		list-style: none;
		position: absolute;
		z-index: 5;
		left: 0;
		right: 0;
		top: calc(100% + 0.35rem);
		margin: 0;
		padding: 0.35rem;
		background: #f7fbf8;
		border: 1.5px solid var(--line);
		border-radius: 0.75rem;
		box-shadow: 0 12px 28px rgba(19, 32, 24, 0.12);
		max-height: 14rem;
		overflow: auto;
	}

	.picker__option {
		appearance: none;
		border: none;
		background: transparent;
		width: 100%;
		text-align: left;
		font: inherit;
		padding: 0.55rem 0.65rem;
		border-radius: 0.55rem;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		color: inherit;
	}

	.picker__option:hover,
	.picker__option--active {
		background: rgba(27, 107, 69, 0.1);
	}

	.picker__name {
		font-weight: 650;
	}

	.picker__email {
		font-size: 0.8rem;
		color: var(--ink-soft);
	}

	.picker__empty {
		margin: 0.35rem 0 0;
		font-size: 0.88rem;
		color: var(--ink-soft);
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
		font-size: 0.95rem;
	}

	.text-link {
		color: var(--leaf-deep);
		font-weight: 600;
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
