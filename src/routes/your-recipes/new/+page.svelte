<script lang="ts">
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import RecipeForm from '$lib/components/RecipeForm.svelte';
	import { createRecipe } from '$lib/recipes-api';
	import { pageTitle } from '$lib/site';
	import type { RecipeInput } from '$lib/types';

	let error = $state('');
	let saving = $state(false);

	async function save(input: RecipeInput) {
		saving = true;
		error = '';
		try {
			const recipe = await createRecipe(input);
			goto(`${base}/your-recipes/${recipe.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save recipe';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('New recipe')}</title>
</svelte:head>

<main class="page">
	<h1>New recipe</h1>
	<p class="lede">Paste a recipe site, Instagram Reel, or Facebook Reel link to auto-fill what we can — or enter everything by hand.</p>

	{#if saving}
		<p class="muted">Saving…</p>
	{:else}
		<RecipeForm
			submitLabel="Save recipe"
			cancelHref="{base}/your-recipes"
			{error}
			onsubmit={save}
		/>
	{/if}
</main>

<style>
	.page {
		width: min(40rem, 100%);
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin-bottom: 0.65rem;
	}

	.lede {
		color: var(--ink-soft);
		margin-bottom: 1.75rem;
		max-width: 40ch;
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
