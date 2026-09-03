<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { deleteRecipe, getRecipe, shareRecipe } from '$lib/recipes-api';
	import { listFriends } from '$lib/friends-api';
	import CostEstimatePanel from '$lib/components/CostEstimatePanel.svelte';
	import { aggregateIngredientLines } from '$lib/ingredients';
	import { pageTitle } from '$lib/site';
	import type { PublicUser, Recipe } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	type Scale = 0.5 | 1 | 2;

	let recipe = $state<Recipe | null>(null);
	let ready = $state(false);
	let error = $state('');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let shareOpen = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);
	let shareDialogEl = $state<HTMLDialogElement | null>(null);
	let scale = $state<Scale>(1);

	let friends = $state<PublicUser[]>([]);
	let friendsReady = $state(false);
	let friendsError = $state('');
	let shareMsg = $state('');
	let sharingId = $state('');

	const scaledIngredients = $derived(
		recipe ? aggregateIngredientLines(recipe.ingredients, scale) : []
	);

	const totalMinutes = $derived(
		recipe ? (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0) : 0
	);

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

	function formatMins(mins: number | undefined): string {
		const n = mins ?? 0;
		if (n <= 0) return '—';
		return `${n} min${n === 1 ? '' : 's'}`;
	}

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
		<div class="topbar">
			<p class="eyebrow">
				<a href="{base}/your-recipes">Recipes</a>
				<span class="eyebrow__sep" aria-hidden="true">›</span>
				<span class="eyebrow__current">{recipe.title}</span>
			</p>
			<div class="actions">
				<button type="button" class="btn btn--ghost" onclick={openShare} disabled={busy}>
					Share
				</button>
				<a class="btn btn--ghost" href="{base}/your-recipes/{recipe.id}/edit">Edit</a>
				<button type="button" class="btn btn--danger" onclick={askDelete} disabled={busy}>
					Delete
				</button>
			</div>
		</div>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<div class="layout">
			<section class="main-col">
				<h1>{recipe.title}</h1>
				{#if recipe.description}
					<p class="lede">{recipe.description}</p>
				{/if}

				<div class="sheet">
					<div class="meta" role="group" aria-label="Recipe timing and servings">
						<div class="meta__cell">
							<span class="meta__label">Prep Time</span>
							<span class="meta__value">{formatMins(recipe.prepMinutes)}</span>
						</div>
						<div class="meta__cell">
							<span class="meta__label">Cook Time</span>
							<span class="meta__value">{formatMins(recipe.cookMinutes)}</span>
						</div>
						<div class="meta__cell">
							<span class="meta__label">Total Time</span>
							<span class="meta__value">{formatMins(totalMinutes)}</span>
						</div>
						<div class="meta__cell">
							<span class="meta__label">Servings</span>
							<span class="meta__value"
								>{(recipe.servings ?? 0) > 0 ? recipe.servings : '—'}</span
							>
						</div>
					</div>

					{#if recipe.steps.length}
						<div class="directions directions--ruled">
							<h2>Directions</h2>
							<ol class="steps">
								{#each recipe.steps as step, i}
									<li>
										<span class="steps__label">Step {i + 1}</span>
										<p class="steps__text">{step}</p>
									</li>
								{/each}
							</ol>
						</div>
					{:else}
						<p class="empty">No directions yet.</p>
					{/if}
				</div>
			</section>

			<aside class="side-col">
				<h2 class="ingredients-title">Ingredients</h2>
				<div class="ingredients-card">
					{#if recipe.ingredients.length}
						<div class="scale" role="group" aria-label="Scale ingredients">
							{#each [{ value: 0.5, label: '1/2x' }, { value: 1, label: '1x' }, { value: 2, label: '2x' }] as opt}
								<button
									type="button"
									class="scale__btn"
									class:scale__btn--active={scale === opt.value}
									aria-pressed={scale === opt.value}
									onclick={() => (scale = opt.value as Scale)}
								>
									{#if scale === opt.value}
										<span class="scale__check" aria-hidden="true">✓</span>
									{/if}
									{opt.label}
								</button>
							{/each}
						</div>
						<ul class="ingredients">
							{#each scaledIngredients as item}
								<li>{item}</li>
							{/each}
						</ul>
					{:else}
						<p class="empty empty--side">No ingredients yet.</p>
					{/if}
				</div>

				{#if scaledIngredients.length > 0}
					<div class="estimate">
						<CostEstimatePanel
							lines={scaledIngredients}
							title="Estimated recipe cost"
							persistKey={`recipe:${recipe.id}:x${scale}`}
							pricing="portion"
						/>
					</div>
				{/if}
			</aside>
		</div>
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
		position: relative;
		isolation: isolate;
		width: min(68rem, 100%);
		padding: clamp(1.5rem, 4vh, 2.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.page::before {
		content: '';
		position: absolute;
		inset: 0 -8% auto;
		height: min(42rem, 90vh);
		z-index: -1;
		pointer-events: none;
		opacity: 0.14;
		background:
			radial-gradient(ellipse 40% 35% at 8% 18%, #1b6b45 0%, transparent 70%),
			radial-gradient(ellipse 35% 40% at 92% 12%, #124f32 0%, transparent 68%),
			radial-gradient(ellipse 28% 30% at 78% 55%, #1b6b45 0%, transparent 70%);
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cpath fill='black' d='M40 20c20 10 35 40 28 70-8 35-40 50-55 35S-5 70 10 40C20 25 30 15 40 20zm120 10c18 12 30 38 22 65-10 32-38 48-55 32s-10-55 12-78c12-12 14-22 21-19zm-50 70c16 8 28 30 20 52-9 26-32 38-46 26s-8-42 10-60c10-10 12-20 16-18z'/%3E%3C/svg%3E");
		mask-size: 28rem;
		mask-repeat: no-repeat;
		mask-position: right -2rem top 1rem;
	}

	.topbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem 1rem;
		margin-bottom: 1.25rem;
	}

	.eyebrow {
		font-size: 0.92rem;
		margin: 0;
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

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(16rem, 0.85fr);
		gap: clamp(1.25rem, 3vw, 2.25rem);
		align-items: start;
	}

	.main-col h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2.1rem, 4.5vw, 3.15rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin: 0 0 0.55rem;
		color: var(--leaf-deep);
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.05rem;
		margin: 0 0 1.15rem;
		max-width: 46ch;
	}

	.sheet {
		background: rgba(255, 255, 255, 0.92);
		border: 1.5px solid rgba(19, 32, 24, 0.08);
		border-radius: 0.35rem 0.35rem 1.15rem 1.15rem;
		overflow: hidden;
		box-shadow: 0 10px 28px rgba(19, 32, 24, 0.06);
		border-top: 0.55rem solid var(--leaf-deep);
	}

	.meta {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0.65rem 1rem;
		padding: 1rem 1.25rem 1.05rem;
		background: #fff;
		color: var(--ink);
	}

	.meta__cell {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
	}

	.meta__label {
		font-weight: 700;
		font-size: 0.88rem;
		color: var(--ink);
	}

	.meta__value {
		font-size: 0.95rem;
		font-weight: 500;
		color: var(--ink-soft);
	}

	.directions {
		padding: 1.25rem 1.3rem 1.5rem;
	}

	.directions--ruled {
		border-top: 1.5px solid rgba(19, 32, 24, 0.1);
	}

	.directions h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		color: var(--leaf-deep);
		margin: 0 0 1rem;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 1.1rem;
	}

	.steps__label {
		display: block;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--leaf-deep);
		margin-bottom: 0.25rem;
	}

	.steps__text {
		margin: 0;
		color: var(--ink);
		line-height: 1.55;
		font-size: 0.98rem;
	}

	.side-col {
		position: sticky;
		top: 1rem;
	}

	.ingredients-title {
		font-family: var(--font-script);
		font-weight: 700;
		font-size: clamp(2.1rem, 4vw, 2.75rem);
		line-height: 1;
		color: var(--leaf);
		margin: 0 0 0.65rem;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55);
	}

	.ingredients-card {
		background: rgba(196, 214, 188, 0.72);
		border: 1.5px solid rgba(27, 107, 69, 0.12);
		border-radius: 1.15rem;
		padding: 1rem 1.1rem 1.15rem;
		box-shadow: 0 10px 24px rgba(19, 32, 24, 0.05);
	}

	.scale {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.2rem;
		margin-bottom: 0.9rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.45);
		border: 1.5px solid rgba(27, 107, 69, 0.18);
	}

	.scale__btn {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.88rem;
		font-weight: 650;
		color: var(--leaf-deep);
		padding: 0.4rem 0.7rem;
		border-radius: 999px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.scale__btn--active {
		background: #fff;
		box-shadow: 0 1px 4px rgba(19, 32, 24, 0.1);
	}

	.scale__check {
		font-size: 0.85rem;
		color: var(--leaf);
		font-weight: 800;
	}

	.ingredients {
		list-style: disc;
		margin: 0;
		padding: 0 0 0 1.15rem;
		display: grid;
		gap: 0.55rem;
		color: var(--leaf-deep);
		font-style: italic;
		font-size: 0.98rem;
		line-height: 1.4;
	}

	.estimate {
		margin-top: 1rem;
	}

	.empty {
		color: var(--ink-soft);
		padding: 1.25rem 1.3rem;
		margin: 0;
	}

	.empty--side {
		padding: 0.5rem 0.15rem;
		font-style: italic;
		color: var(--leaf-deep);
		opacity: 0.75;
	}

	.error {
		color: #8a2f2f;
		margin-bottom: 1rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.6rem 0.95rem;
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

	@media (max-width: 860px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.side-col {
			position: static;
			order: -1;
		}

		.meta {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page,
		.confirm__panel {
			animation: none;
		}
	}
</style>
