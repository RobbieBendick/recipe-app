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
	import { pageTitle } from '$lib/site';
	import type { ShoppingList } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let list = $state<ShoppingList | null>(null);
	let ready = $state(false);
	let error = $state('');
	let newItem = $state('');
	let busy = $state(false);

	onMount(async () => {
		try {
			list = await getShoppingList(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load list';
		} finally {
			ready = true;
		}
	});

	async function remove() {
		if (!list) return;
		if (!confirm(`Delete “${list.title}”?`)) return;
		busy = true;
		try {
			await deleteShoppingList(list.id);
			goto(`${base}/shopping-lists`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete';
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

	async function removeItem(itemId: string) {
		if (!list) return;
		try {
			list = await removeShoppingListItem(list.id, itemId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to remove item';
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
			<h1>{list.title}</h1>
			<p class="lede">
				{list.items.filter((item) => item.checked).length} of {list.items.length} checked
			</p>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
			<div class="actions">
				<a class="btn btn--soft" href="{base}/shopping-lists/{list.id}/edit">Edit</a>
				<button type="button" class="btn btn--ghost" onclick={remove} disabled={busy}>Delete</button>
			</div>
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
							onclick={() => removeItem(item.id)}
						>
							Remove
						</button>
					</li>
				{/each}
			</ul>

			<CostEstimatePanel
				lines={list.items.map((item) => item.text)}
				title="Estimated shopping list cost"
			/>
		{/if}

		<form class="add" onsubmit={addItem}>
			<input bind:value={newItem} type="text" placeholder="Add an item" aria-label="New item" />
			<button type="submit" class="btn btn--primary" disabled={busy}>Add</button>
		</form>
	{/if}
</main>

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

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		margin-bottom: 0.5rem;
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
		color: var(--ink-soft);
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
		text-decoration: underline;
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

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
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
		.page {
			animation: none;
		}
	}
</style>
