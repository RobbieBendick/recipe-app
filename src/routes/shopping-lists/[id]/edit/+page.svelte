<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import { getShoppingList, updateShoppingList } from '$lib/shopping-lists-api';
	import { pageTitle } from '$lib/site';
	import type { ShoppingList } from '$lib/types';
	import { linesToList, listToLines } from '$lib/util';

	const id = $derived(page.params.id ?? '');

	let list = $state<ShoppingList | null>(null);
	let title = $state('');
	let itemsText = $state('');
	let ready = $state(false);
	let error = $state('');
	let saving = $state(false);

	onMount(async () => {
		try {
			list = await getShoppingList(id);
			if (list) {
				title = list.title;
				itemsText = listToLines(list.items.map((item) => item.text));
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load list';
		} finally {
			ready = true;
		}
	});

	async function save(event: Event) {
		event.preventDefault();
		if (!list) return;
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			error = 'Give your list a name.';
			return;
		}
		saving = true;
		error = '';
		try {
			await updateShoppingList(list.id, {
				title: trimmedTitle,
				items: linesToList(itemsText)
			});
			goto(`${base}/shopping-lists/${list.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Edit', list?.title ?? 'shopping list')}</title>
</svelte:head>

<main class="page">
	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if !list}
		<p class="muted">{error || 'Shopping list not found.'}</p>
		<a href="{base}/shopping-lists">Back to shopping lists</a>
	{:else}
		<p class="eyebrow">
			<a href="{base}/shopping-lists/{list.id}">{list.title}</a>
		</p>
		<h1>Edit list</h1>

		<form class="form" onsubmit={save}>
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<label>
				<span>Title</span>
				<input bind:value={title} type="text" required />
			</label>

			<label>
				<span>Items</span>
				<textarea bind:value={itemsText} rows="10"></textarea>
			</label>

			<div class="actions">
				<button type="submit" class="btn btn--primary" disabled={saving}>
					{saving ? 'Saving…' : 'Save changes'}
				</button>
				<a class="btn btn--ghost" href="{base}/shopping-lists/{list.id}">Cancel</a>
			</div>
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
		margin-bottom: 0.75rem;
	}

	.eyebrow a {
		color: var(--leaf);
		font-weight: 600;
		text-decoration: none;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		margin-bottom: 1.5rem;
	}

	.form {
		display: grid;
		gap: 1.15rem;
	}

	.error {
		color: #8a2f2f;
		background: rgba(138, 47, 47, 0.08);
		border-radius: 0.55rem;
		padding: 0.75rem 0.9rem;
	}

	label {
		display: grid;
		gap: 0.4rem;
	}

	label span {
		font-weight: 600;
		font-size: 0.92rem;
	}

	input,
	textarea {
		width: 100%;
		font: inherit;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.72);
		border: 1.5px solid var(--line);
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.85rem 1.2rem;
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

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.muted {
		color: var(--ink-soft);
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
