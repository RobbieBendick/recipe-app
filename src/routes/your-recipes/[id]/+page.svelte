<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import {
		deleteRecipe,
		getRecipe
	} from '$lib/recipes-api';
	import CostEstimatePanel from '$lib/components/CostEstimatePanel.svelte';
	import { displayEmoji } from '$lib/emoji';
	import { pageTitle } from '$lib/site';
	import type { Recipe } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let recipe = $state<Recipe | null>(null);
	let ready = $state(false);
	let error = $state('');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let dialogEl = $state<HTMLDialogElement | null>(null);

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

			<CostEstimatePanel lines={recipe.ingredients} title="Estimated recipe cost" />
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
{/if}

<style>
	.page {
		width: min(42rem, 100%);
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
