<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import {
		addShoppingListItem,
		deleteShoppingList,
		getShoppingList,
		removeShoppingListItem,
		toggleShoppingListItem
	} from '$lib/shopping-lists-api';
	import CostEstimatePanel from '$lib/components/CostEstimatePanel.svelte';
	import { displayEmoji } from '$lib/emoji';
	import { listRecipes } from '$lib/recipes-api';
	import { pageTitle } from '$lib/site';
	import type { Recipe, ShoppingList } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let list = $state<ShoppingList | null>(null);
	let recipes = $state<Recipe[]>([]);
	let ready = $state(false);
	let error = $state('');
	let newItem = $state('');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let confirmMode = $state<'list' | 'item'>('list');
	let pendingItem = $state<{ id: string; text: string } | null>(null);
	let dialogEl = $state<HTMLDialogElement | null>(null);

	const listRecipesOnList = $derived.by(() => {
		if (!list?.recipeCounts) return [];
		const counts = list.recipeCounts;
		return recipes
			.map((recipe) => ({
				recipe,
				count: counts[recipe.id] ?? 0
			}))
			.filter((entry) => entry.count > 0)
			.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
	});

	onMount(async () => {
		try {
			const [loadedList, loadedRecipes] = await Promise.all([
				getShoppingList(id),
				listRecipes().catch(() => [] as Recipe[])
			]);
			list = loadedList;
			recipes = loadedRecipes;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load list';
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

	function askDeleteList() {
		if (!list || busy) return;
		confirmMode = 'list';
		pendingItem = null;
		confirmOpen = true;
	}

	function askRemoveItem(itemId: string, text: string) {
		if (!list || busy) return;
		confirmMode = 'item';
		pendingItem = { id: itemId, text };
		confirmOpen = true;
	}

	function cancelConfirm() {
		if (busy) return;
		confirmOpen = false;
		pendingItem = null;
	}

	async function confirmAction() {
		if (!list) return;
		busy = true;
		error = '';
		try {
			if (confirmMode === 'list') {
				await deleteShoppingList(list.id);
				confirmOpen = false;
				goto(`${base}/shopping-lists`);
				return;
			}
			if (pendingItem) {
				list = await removeShoppingListItem(list.id, pendingItem.id);
			}
			confirmOpen = false;
			pendingItem = null;
		} catch (e) {
			error =
				e instanceof Error
					? e.message
					: confirmMode === 'list'
						? 'Failed to delete'
						: 'Failed to remove item';
			confirmOpen = false;
			pendingItem = null;
		} finally {
			busy = false;
		}
	}

	async function addItem(event: Event) {
		event.preventDefault();
		if (!list) return;
		busy = true;
		error = '';
		try {
			list = await addShoppingListItem(list.id, newItem);
			newItem = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add item';
		} finally {
			busy = false;
		}
	}

	async function toggle(itemId: string) {
		if (!list) return;
		try {
			list = await toggleShoppingListItem(list.id, itemId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update item';
		}
	}
</script>

<svelte:head>
	<title>{pageTitle(list?.title ?? 'Shopping list')}</title>
</svelte:head>

<main class="page">
	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if !list}
		<p class="muted">{error || 'Shopping list not found.'}</p>
		<a class="text-link" href="{base}/shopping-lists">Back to shopping lists</a>
	{:else}
		<p class="eyebrow">
			<a href="{base}/shopping-lists">Shopping lists</a>
		</p>
		<header class="header">
			<div class="title-row">
				<h1>{list.title}</h1>
				<div class="actions">
					<a class="btn btn--soft" href="{base}/shopping-lists/{list.id}/edit">Edit</a>
					<button type="button" class="btn btn--danger" onclick={askDeleteList} disabled={busy}>
						Delete
					</button>
				</div>
			</div>
			{#if listRecipesOnList.length > 0}
				<ul class="recipe-chips" aria-label="Recipes on this list">
					{#each listRecipesOnList as { recipe, count } (recipe.id)}
						<li>
							<a class="recipe-chip" href="{base}/your-recipes/{recipe.id}">
								<span class="recipe-chip__emoji" aria-hidden="true"
									>{displayEmoji(recipe.emoji)}</span
								>
								<span class="recipe-chip__title">{recipe.title}</span>
								<span class="recipe-chip__count">{count}×</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			<p class="lede">
				{list.items.filter((item) => item.checked).length} of {list.items.length} checked
			</p>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
		</header>

		{#if list.items.length === 0}
			<p class="muted">No items yet — add one below.</p>
		{:else}
			<ul class="items">
				{#each list.items as item (item.id)}
					<li class:checked={item.checked}>
						<label>
							<input
								type="checkbox"
								checked={item.checked}
								onchange={() => toggle(item.id)}
							/>
							<span>{item.text}</span>
						</label>
						<button
							type="button"
							class="remove"
							aria-label="Remove {item.text}"
							onclick={() => askRemoveItem(item.id, item.text)}
							disabled={busy}
						>
							Remove
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<form class="add" onsubmit={addItem}>
			<input bind:value={newItem} type="text" placeholder="Add an item" aria-label="New item" />
			<button type="submit" class="btn btn--primary" disabled={busy}>Add</button>
		</form>

		{#if list.items.length > 0}
			<CostEstimatePanel
				lines={list.items.map((item) => item.text)}
				title="Estimated shopping list cost"
				persistKey={`list:${list.id}`}
				pricing="packages"
			/>
		{/if}
	{/if}
</main>

{#if list}
	<dialog
		class="confirm"
		bind:this={dialogEl}
		aria-labelledby="confirm-title"
		aria-describedby="confirm-desc"
		onclose={() => {
			confirmOpen = false;
			pendingItem = null;
		}}
		onclick={(event) => {
			if (event.target === dialogEl) cancelConfirm();
		}}
	>
		<div class="confirm__panel">
			{#if confirmMode === 'list'}
				<h2 id="confirm-title">Delete shopping list?</h2>
				<p id="confirm-desc">
					“{list.title}” will be removed for good. This can’t be undone.
				</p>
			{:else}
				<h2 id="confirm-title">Remove item?</h2>
				<p id="confirm-desc">
					“{pendingItem?.text ?? 'This item'}” will be taken off the list.
				</p>
			{/if}
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={cancelConfirm} disabled={busy}>
					Cancel
				</button>
				<button type="button" class="btn btn--danger" onclick={confirmAction} disabled={busy}>
					{#if busy}
						{confirmMode === 'list' ? 'Deleting…' : 'Removing…'}
					{:else}
						{confirmMode === 'list' ? 'Delete' : 'Remove'}
					{/if}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.page {
		width: min(40rem, 100%);
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.eyebrow {
		margin-bottom: 0.85rem;
	}

	.eyebrow a {
		color: var(--leaf);
		font-weight: 600;
		text-decoration: none;
	}

	.header {
		margin-bottom: 1.75rem;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.5rem;
	}

	.recipe-chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0 0 0.85rem;
		padding: 0;
	}

	.recipe-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 100%;
		padding: 0.35rem 0.65rem 0.35rem 0.4rem;
		border-radius: 999px;
		border: 1.5px solid rgba(27, 107, 69, 0.18);
		background: rgba(232, 244, 236, 0.95);
		color: var(--leaf-deep);
		text-decoration: none;
		font-size: 0.86rem;
		font-weight: 600;
		transition:
			background 0.15s var(--ease),
			border-color 0.15s var(--ease);
	}

	.recipe-chip:hover {
		background: #e2f0e6;
		border-color: rgba(27, 107, 69, 0.3);
	}

	.recipe-chip__emoji {
		font-size: 1rem;
		line-height: 1;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.recipe-chip__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 12rem;
	}

	.recipe-chip__count {
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		font-size: 0.8rem;
		opacity: 0.85;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		margin: 0;
		min-width: 0;
		flex: 1;
	}

	.lede {
		color: var(--ink-soft);
		margin-bottom: 1rem;
	}

	.error {
		color: #8a2f2f;
		margin-bottom: 0.75rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		flex-shrink: 0;
	}

	.items {
		list-style: none;
		display: grid;
		gap: 0.45rem;
		margin-bottom: 1.5rem;
	}

	.items li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.75rem 0.9rem;
		border-radius: 0.65rem;
		background: rgba(255, 255, 255, 0.55);
		border: 1.5px solid var(--line);
	}

	.items li.checked span {
		text-decoration: line-through;
		color: var(--ink-soft);
		opacity: 0.7;
	}

	.items label {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex: 1;
		cursor: pointer;
	}

	.items input {
		width: 1.1rem;
		height: 1.1rem;
		accent-color: var(--leaf);
	}

	.remove {
		appearance: none;
		border: none;
		background: transparent;
		color: #b43a3a;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.remove:hover:not(:disabled) {
		color: #9c2f2f;
	}

	.remove:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
	}

	.add input {
		flex: 1;
		min-width: 12rem;
		font: inherit;
		padding: 0.75rem 0.85rem;
		border-radius: 0.55rem;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.72);
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

	.btn--soft {
		background: var(--mist);
		color: var(--leaf-deep);
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

	.confirm__panel p {
		color: var(--ink-soft);
		font-size: 0.98rem;
		line-height: 1.45;
		margin-bottom: 1.2rem;
	}

	.confirm__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.55rem;
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
