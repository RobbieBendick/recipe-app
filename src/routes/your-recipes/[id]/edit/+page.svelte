<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import { getRecipe, updateRecipe } from '$lib/recipes-api';
	import { pageTitle } from '$lib/site';
	import type { Recipe, RecipeInput } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let recipe = $state<Recipe | null>(null);
	let ready = $state(false);
	let error = $state('');
	let saving = $state(false);

	onMount(async () => {
		try {
			recipe = await getRecipe(id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load recipe';
		} finally {
			ready = true;
		}
	});

	async function save(input: RecipeInput) {
		saving = true;
		error = '';
		try {
			await updateRecipe(id, input);
			goto(`${base}/your-recipes/${id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Edit', recipe?.title ?? 'recipe')}</title>
</svelte:head>

<main class="page">
	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if !recipe}
		<p class="muted">{error || 'Recipe not found.'}</p>
		<a href="{base}/your-recipes">Back to recipes</a>
	{:else}
		<p class="eyebrow">
			<a href="{base}/your-recipes/{recipe.id}">{recipe.title}</a>
		</p>
		<h1>Edit recipe</h1>
		{#if saving}
			<p class="muted">Saving…</p>
		{:else}
			<RecipeForm
				initial={{
					title: recipe.title,
					description: recipe.description,
					emoji: recipe.emoji || '🍽️',
					ingredients: recipe.ingredients,
					steps: recipe.steps
				}}
				submitLabel="Save changes"
				cancelHref="{base}/your-recipes/{recipe.id}"
				{error}
				onsubmit={save}
			/>
		{/if}
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
