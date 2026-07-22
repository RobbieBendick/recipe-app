<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { deleteRecipe, getRecipe, shareRecipe } from '$lib/recipes-api';
	import { listFriends } from '$lib/friends-api';
	import CostEstimatePanel from '$lib/components/CostEstimatePanel.svelte';
	import { displayEmoji } from '$lib/emoji';
	import { pageTitle } from '$lib/site';
	import type { PublicUser, Recipe } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let recipe = $state<Recipe | null>(null);
	let ready = $state(false);
	let error = $state('');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let shareOpen = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);
	let shareDialogEl = $state<HTMLDialogElement | null>(null);

	let friends = $state<PublicUser[]>([]);
	let friendsReady = $state(false);
	let friendsError = $state('');
	let shareMsg = $state('');
	let sharingId = $state('');

	onMount(async () => {
		try {
			recipe = await getRecipe(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load recipe';
		} finally {
			ready = true;
		}
	});

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (confirmOpen && !el.open) el.showModal();
		if (!confirmOpen && el.open) el.close();
	});

	$effect(() => {
		const el = shareDialogEl;
		if (!el) return;
		if (shareOpen && !el.open) el.showModal();
		if (!shareOpen && el.open) el.close();
	});

	function askDelete() {
		if (!recipe || busy) return;
		confirmOpen = true;
	}

	function cancelDelete() {
		if (busy) return;
		confirmOpen = false;
	}

	async function confirmDelete() {
		if (!recipe) return;
		busy = true;
		error = '';
		try {
			await deleteRecipe(recipe.id);
			confirmOpen = false;
			goto(`${base}/your-recipes`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete';
			busy = false;
			confirmOpen = false;
		}
	}

	async function openShare() {
		if (!recipe || busy) return;
		shareOpen = true;
		shareMsg = '';
		friendsError = '';
		if (!friendsReady) {
			try {
				friends = await listFriends();
			} catch (e) {
				friendsError = e instanceof Error ? e.message : 'Failed to load friends';
			} finally {
				friendsReady = true;
			}
		}
	}

	function closeShare() {
		if (sharingId) return;
		shareOpen = false;
	}

	async function sendToFriend(friend: PublicUser) {
		if (!recipe) return;
		sharingId = friend.id;
		shareMsg = '';
		friendsError = '';
		try {
			await shareRecipe(recipe.id, friend.id);
			shareMsg = `Sent to ${friend.name?.trim() || friend.email}`;
		} catch (e) {
			friendsError = e instanceof Error ? e.message : 'Failed to share recipe';
		} finally {
			sharingId = '';
		}
	}

	function friendLabel(u: PublicUser) {
		return u.name?.trim() || u.email;
	}

	function friendInitial(u: PublicUser) {
		return (u.name || u.email || '?').slice(0, 1).toUpperCase();
	}
</script>

<svelte:head>
	<title>{pageTitle(recipe?.title ?? 'Recipe')}</title>
</svelte:head>

<main class="page">
	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if !recipe}
		<p class="muted">{error || 'Recipe not found.'}</p>
		<a class="text-link" href="{base}/your-recipes">Back to recipes</a>
	{:else}
		<p class="eyebrow">
			<a href="{base}/your-recipes">Recipes</a>
			<span class="eyebrow__sep" aria-hidden="true">›</span>
			<span class="eyebrow__current">{recipe.title}</span>
		</p>
		<header class="header">
			<div class="title-row">
				<h1>
					<span class="emoji" aria-hidden="true">{displayEmoji(recipe.emoji)}</span>
					{recipe.title}
				</h1>
				<div class="actions">
					<button type="button" class="btn btn--ghost" onclick={openShare} disabled={busy}>
						Share
					</button>
					<a class="btn btn--primary" href="{base}/your-recipes/{recipe.id}/edit">Edit</a>
					<button type="button" class="btn btn--danger" onclick={askDelete} disabled={busy}>
						Delete
					</button>
				</div>
			</div>
			{#if recipe.description}
				<p class="lede">{recipe.description}</p>
			{/if}
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
		</header>

		{#if recipe.ingredients.length}
			<section class="block">
				<h2>Ingredients</h2>
				<ul>
					{#each recipe.ingredients as item}
						<li>{item}</li>
					{/each}
				</ul>
			</section>

			<CostEstimatePanel
				lines={recipe.ingredients}
				title="Estimated recipe cost"
				persistKey={`recipe:${recipe.id}`}
				pricing="portion"
			/>
		{/if}

		{#if recipe.steps.length}
			<section class="block">
				<h2>Steps</h2>
				<ol>
					{#each recipe.steps as step}
						<li>{step}</li>
					{/each}
				</ol>
			</section>
		{/if}
	{/if}
</main>

{#if recipe}
	<dialog
		class="confirm"
		bind:this={dialogEl}
		aria-labelledby="delete-title"
		aria-describedby="delete-desc"
		onclose={() => {
			confirmOpen = false;
		}}
		onclick={(event) => {
			if (event.target === dialogEl) cancelDelete();
		}}
	>
		<div class="confirm__panel">
			<h2 id="delete-title">Delete recipe?</h2>
			<p id="delete-desc">
				“{recipe.title}” will be removed for good. This can’t be undone.
			</p>
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={cancelDelete} disabled={busy}>
					Cancel
				</button>
				<button type="button" class="btn btn--danger" onclick={confirmDelete} disabled={busy}>
					{busy ? 'Deleting…' : 'Delete'}
				</button>
			</div>
		</div>
	</dialog>

	<dialog
		class="confirm share-dialog"
		bind:this={shareDialogEl}
		aria-labelledby="share-title"
		onclose={() => {
			shareOpen = false;
		}}
		onclick={(event) => {
			if (event.target === shareDialogEl) closeShare();
		}}
	>
		<div class="confirm__panel">
			<h2 id="share-title">Share with a friend</h2>
			<p>They’ll get a notification and can accept to add a copy of this recipe.</p>

			{#if !friendsReady}
				<p class="share-muted">Loading friends…</p>
			{:else if friendsError && friends.length === 0}
				<p class="error" role="alert">{friendsError}</p>
			{:else if friends.length === 0}
				<p class="share-muted">
					No friends yet.
					<a class="text-link" href="{base}/friends" onclick={closeShare}>Add friends</a>
					to share recipes.
				</p>
			{:else}
				{#if friendsError}
					<p class="error" role="alert">{friendsError}</p>
				{/if}
				{#if shareMsg}
					<p class="share-ok" role="status">{shareMsg}</p>
				{/if}
				<ul class="friend-list">
					{#each friends as friend (friend.id)}
						<li>
							<button
								type="button"
								class="friend-row"
								disabled={Boolean(sharingId)}
								onclick={() => void sendToFriend(friend)}
							>
								<span class="friend-avatar" aria-hidden="true">
									{#if friend.avatarUrl}
										<img
											src={friend.avatarUrl}
											alt=""
											width="36"
											height="36"
											referrerpolicy="no-referrer"
										/>
									{:else}
										<span class="friend-avatar__fallback">{friendInitial(friend)}</span>
									{/if}
								</span>
								<span class="friend-text">
									<span class="friend-name">{friendLabel(friend)}</span>
									<span class="friend-email">{friend.email}</span>
								</span>
								<span class="friend-send">
									{sharingId === friend.id ? 'Sending…' : 'Send'}
								</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}

			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={closeShare} disabled={Boolean(sharingId)}>
					Done
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.page {
		width: min(65rem, 100%);
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
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

	.eyebrow a:hover {
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.eyebrow__sep {
		opacity: 0.55;
	}

	.eyebrow__current {
		font-weight: 500;
		color: var(--ink-soft);
	}

	.header {
		margin-bottom: 2rem;
	}

	.title-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1.25rem;
		margin-bottom: 0.75rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
		flex: 1 1 12rem;
	}

	.emoji {
		font-size: 0.9em;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.08rem;
		margin-bottom: 0;
		max-width: 42ch;
	}

	.error {
		color: #8a2f2f;
		margin-top: 0.75rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		flex-shrink: 0;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.75rem 1.1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn--danger {
		background: #b43a3a;
		color: #fff8f8;
	}

	.btn--danger:hover:not(:disabled) {
		background: #9c2f2f;
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.confirm {
		position: fixed;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0;
		border: none;
		border-radius: 1.1rem;
		background: transparent;
		max-width: min(24rem, calc(100vw - 2rem));
	}

	.share-dialog {
		max-width: min(26rem, calc(100vw - 2rem));
	}

	.confirm::backdrop {
		background: rgba(19, 32, 24, 0.45);
		backdrop-filter: blur(4px);
	}

	.confirm__panel {
		padding: 1.35rem 1.4rem 1.25rem;
		background: #f7fbf8;
		border: 1px solid rgba(19, 32, 24, 0.08);
		border-radius: 1.1rem;
		box-shadow: 0 18px 40px rgba(19, 32, 24, 0.18);
		animation: rise 0.28s var(--ease) both;
	}

	.confirm__panel h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.45rem;
	}

	.confirm__panel > p {
		color: var(--ink-soft);
		font-size: 0.98rem;
		line-height: 1.45;
		margin-bottom: 1rem;
	}

	.confirm__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.55rem;
		margin-top: 1rem;
	}

	.share-muted {
		color: var(--ink-soft);
		font-size: 0.95rem;
		margin-bottom: 0.5rem;
	}

	.share-ok {
		color: var(--leaf-deep);
		font-size: 0.9rem;
		font-weight: 600;
		margin-bottom: 0.55rem;
	}

	.friend-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		max-height: min(16rem, 45vh);
		overflow: auto;
	}

	.friend-row {
		appearance: none;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.65);
		border-radius: 0.75rem;
		padding: 0.55rem 0.65rem;
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.65rem;
		text-align: left;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}

	.friend-row:hover:not(:disabled) {
		border-color: rgba(27, 107, 69, 0.35);
		background: rgba(27, 107, 69, 0.06);
	}

	.friend-row:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.friend-avatar {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		overflow: hidden;
		flex-shrink: 0;
		background: rgba(27, 107, 69, 0.12);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.friend-avatar img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.friend-avatar__fallback {
		font-weight: 700;
		font-size: 0.9rem;
		color: var(--leaf-deep);
	}

	.friend-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}

	.friend-name {
		font-weight: 650;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friend-email {
		font-size: 0.8rem;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.friend-send {
		font-size: 0.82rem;
		font-weight: 700;
		color: var(--leaf);
		flex-shrink: 0;
	}

	.block {
		margin-bottom: 1.75rem;
	}

	.block h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		margin-bottom: 0.7rem;
	}

	ul,
	ol {
		padding-left: 1.2rem;
		color: var(--ink-soft);
		display: grid;
		gap: 0.45rem;
	}

	.muted {
		color: var(--ink-soft);
		margin-bottom: 0.75rem;
	}

	.text-link {
		color: var(--leaf-deep);
		font-weight: 600;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.75rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page,
		.confirm__panel {
			animation: none;
		}
	}
</style>
