<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { displayEmoji } from '$lib/emoji';
	import ScanListPhoto from '$lib/components/ScanListPhoto.svelte';
	import { listRecipes } from '$lib/recipes-api';
	import { createShoppingList } from '$lib/shopping-lists-api';
	import { pageTitle } from '$lib/site';
	import type { ImportedShoppingList, Recipe } from '$lib/types';
	import { aggregateIngredientLines, mergeIngredientLists } from '$lib/ingredients';
	import { linesToList } from '$lib/util';

	function defaultListTitle(date = new Date()): string {
		return date.toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	const defaultTitle = defaultListTitle();

	let recipes = $state<Recipe[]>([]);
	let title = $state(defaultTitle);
	let itemsText = $state('');
	let recipeCounts = $state<Record<string, number>>({});
	let justAddedId = $state('');
	let error = $state('');
	let saving = $state(false);
	let dragging = $state(false);
	let overDrop = $state(false);
	let ready = $state(false);

	const addedRecipes = $derived(
		recipes
			.filter((recipe) => (recipeCounts[recipe.id] ?? 0) > 0)
			.map((recipe) => ({
				recipe,
				count: recipeCounts[recipe.id] ?? 0
			}))
	);

	const totalAdds = $derived(
		Object.values(recipeCounts).reduce((sum, count) => sum + count, 0)
	);

	onMount(async () => {
		try {
			recipes = await listRecipes();
		} catch {
			recipes = [];
		} finally {
			ready = true;
		}
	});

	function countFor(id: string): number {
		return recipeCounts[id] ?? 0;
	}

	function flash(recipeId: string) {
		justAddedId = recipeId;
		window.setTimeout(() => {
			if (justAddedId === recipeId) justAddedId = '';
		}, 700);
	}

	function rebuildItems(counts: Record<string, number>) {
		const lists = recipes
			.map((recipe) => {
				const servings = counts[recipe.id] ?? 0;
				if (servings <= 0) return [];
				return aggregateIngredientLines(recipe.ingredients, servings);
			})
			.filter((list) => list.length > 0);

		itemsText = mergeIngredientLists(lists).join('\n');
	}

	function appendRecipe(recipe: Recipe) {
		if (!title.trim()) {
			title = `Shop: ${recipe.title}`;
		}

		const next = { ...recipeCounts, [recipe.id]: countFor(recipe.id) + 1 };
		recipeCounts = next;
		rebuildItems(next);
		flash(recipe.id);
	}

	function removeRecipe(recipe: Recipe) {
		const current = countFor(recipe.id);
		if (current <= 0) return;

		const nextCount = current - 1;
		let next: Record<string, number>;
		if (nextCount <= 0) {
			const { [recipe.id]: _, ...rest } = recipeCounts;
			next = rest;
		} else {
			next = { ...recipeCounts, [recipe.id]: nextCount };
		}

		recipeCounts = next;
		rebuildItems(next);
		flash(recipe.id);
	}

	function onDragStart(event: DragEvent, recipe: Recipe) {
		if (!event.dataTransfer) return;
		dragging = true;
		event.dataTransfer.effectAllowed = 'copy';
		event.dataTransfer.setData('text/recipe-id', recipe.id);
		event.dataTransfer.setData('text/plain', recipe.title);
	}

	function onDragEnd() {
		dragging = false;
		overDrop = false;
	}

	function onDragOver(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
		overDrop = true;
	}

	function onDragLeave(event: DragEvent) {
		const target = event.currentTarget as HTMLElement;
		const related = event.relatedTarget as Node | null;
		if (related && target.contains(related)) return;
		overDrop = false;
	}

	function onDrop(event: DragEvent) {
		event.preventDefault();
		overDrop = false;
		dragging = false;
		const id = event.dataTransfer?.getData('text/recipe-id');
		if (!id) return;
		const recipe = recipes.find((r) => r.id === id);
		if (!recipe) return;
		appendRecipe(recipe);
	}

	function applyPhotoImport(imported: ImportedShoppingList) {
		const existing = linesToList(itemsText);
		itemsText = mergeIngredientLists([existing, imported.items]).join('\n');
		if (imported.title && title.trim() === defaultTitle) {
			title = imported.title;
		}
	}

	async function save(event: Event) {
		event.preventDefault();
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			error = 'Give your list a name.';
			return;
		}

		saving = true;
		error = '';
		try {
			const firstId = addedRecipes[0]?.recipe.id;
			const counts: Record<string, number> = {};
			for (const [recipeId, count] of Object.entries(recipeCounts)) {
				if (count > 0) counts[recipeId] = count;
			}
			const list = await createShoppingList({
				title: trimmedTitle,
				items: linesToList(itemsText),
				sourceRecipeId: firstId,
				recipeCounts: counts
			});
			goto(`${base}/shopping-lists/${list.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save list';
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('New shopping list')}</title>
</svelte:head>

<main class="page">
	<header class="intro">
		<h1>New shopping list</h1>
		<p class="lede">Drag recipes onto the list, or snap a photo of a written list or groceries.</p>
	</header>

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<div class="layout">
		<aside class="recipes" aria-label="Your recipes">
			<div class="recipes__head">
				<h2>Recipes</h2>
				<p>Drag onto the list, or use − / + to set how many.</p>
			</div>

			{#if !ready}
				<p class="muted">Loading recipes…</p>
			{:else if recipes.length === 0}
				<p class="muted">
					No recipes yet. <a href="{base}/your-recipes/new">Add one</a> first.
				</p>
			{:else}
				<ul class="recipes__list">
					{#each recipes as recipe (recipe.id)}
						{@const count = countFor(recipe.id)}
						<li>
							<div
								class="recipe"
								class:used={count > 0}
								class:pulse={justAddedId === recipe.id}
								draggable="true"
								role="group"
								aria-label="{recipe.title}{count > 0 ? `, added ${count}x` : ''}"
								ondragstart={(event) => onDragStart(event, recipe)}
								ondragend={onDragEnd}
							>
								<span class="recipe__emoji" aria-hidden="true"
									>{displayEmoji(recipe.emoji)}</span
								>
								<span class="recipe__body">
									<span class="recipe__title">{recipe.title}</span>
									<span class="recipe__meta">
										{#if count > 0}
											<span class="recipe__status">On list</span>
										{:else}
											{recipe.ingredients.length}
											{recipe.ingredients.length === 1 ? 'ingredient' : 'ingredients'}
										{/if}
									</span>
								</span>
								<div
									class="stepper"
									role="group"
									aria-label="Servings of {recipe.title}"
									onpointerdown={(event) => event.stopPropagation()}
								>
									<button
										type="button"
										class="stepper__btn"
										aria-label="Remove one {recipe.title}"
										disabled={count === 0}
										onclick={() => removeRecipe(recipe)}
									>
										−
									</button>
									<span class="stepper__value" aria-live="polite">{count}x</span>
									<button
										type="button"
										class="stepper__btn"
										aria-label="Add one {recipe.title}"
										onclick={() => appendRecipe(recipe)}
									>
										+
									</button>
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</aside>

		<form class="form" onsubmit={save}>
			<label>
				<span>Title</span>
				<input bind:value={title} type="text" required placeholder={defaultTitle} />
			</label>

			<div class="photo-import">
				<ScanListPhoto disabled={saving} onimported={applyPhotoImport} />
			</div>

			<div
				class="drop"
				class:drop--active={dragging}
				class:drop--over={overDrop}
				ondragover={onDragOver}
				ondragleave={onDragLeave}
				ondrop={onDrop}
				role="region"
				aria-label="Shopping list items drop zone"
			>
				<div class="drop__hint">
					{#if overDrop}
						Drop to add ingredients
					{:else if totalAdds > 0}
						{totalAdds} recipe{totalAdds === 1 ? '' : 's'} added
					{:else}
						Drop recipes here
					{/if}
				</div>

				{#if addedRecipes.length > 0}
					<ul class="chips" aria-label="Recipes added to this list">
						{#each addedRecipes as { recipe, count } (recipe.id)}
							<li class="chip" class:chip--flash={justAddedId === recipe.id}>
								<span class="chip__emoji" aria-hidden="true"
									>{displayEmoji(recipe.emoji)}</span
								>
								<span class="chip__title">{recipe.title}</span>
								<div class="stepper stepper--chip">
									<button
										type="button"
										class="stepper__btn"
										aria-label="Remove one {recipe.title}"
										onclick={() => removeRecipe(recipe)}
									>
										−
									</button>
									<span class="stepper__value">{count}x</span>
									<button
										type="button"
										class="stepper__btn"
										aria-label="Add one {recipe.title}"
										onclick={() => appendRecipe(recipe)}
									>
										+
									</button>
								</div>
							</li>
						{/each}
					</ul>
				{/if}

				<label class="drop__field">
					<span>Items</span>
					<textarea
						bind:value={itemsText}
						rows="12"
						placeholder={"One item per line\nMilk\nEggs\nSourdough"}
					></textarea>
				</label>
			</div>

			<div class="actions">
				<button type="submit" class="btn btn--primary" disabled={saving}>
					{saving ? 'Saving…' : 'Save list'}
				</button>
				<a class="btn btn--ghost" href="{base}/shopping-lists">Cancel</a>
			</div>
		</form>
	</div>
</main>


<style>
	.page {
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.intro {
		margin-bottom: 1.75rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.75rem);
		letter-spacing: -0.045em;
		margin-bottom: 0.55rem;
	}

	.lede {
		color: var(--ink-soft);
		max-width: 42ch;
	}

	.error {
		color: #8a2f2f;
		background: rgba(138, 47, 47, 0.08);
		border-radius: 0.7rem;
		padding: 0.75rem 0.9rem;
		margin-bottom: 1rem;
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem);
		gap: 1.25rem;
		align-items: start;
	}

	.recipes {
		order: 2;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(19, 32, 24, 0.07);
		border-radius: 1.15rem;
		padding: 1rem;
		backdrop-filter: blur(10px);
	}

	.recipes__head {
		margin-bottom: 0.85rem;
	}

	.recipes__head h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: -0.02em;
		margin-bottom: 0.2rem;
	}

	.recipes__head p {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.muted {
		color: var(--ink-soft);
		font-size: 0.92rem;
	}

	.muted a {
		color: var(--leaf-deep);
		font-weight: 600;
	}

	.recipes__list {
		list-style: none;
		display: grid;
		gap: 0.5rem;
		max-height: min(28rem, 55vh);
		overflow: auto;
		padding-right: 0.15rem;
	}

	.recipe {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 0.45rem;
		align-items: center;
		padding: 0.65rem 0.7rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.72);
		border: 1.5px solid transparent;
		cursor: grab;
		transition:
			border-color 0.2s var(--ease),
			background 0.2s var(--ease),
			transform 0.2s var(--ease),
			box-shadow 0.2s var(--ease);
	}

	.recipe:active {
		cursor: grabbing;
	}

	.recipe:hover {
		border-color: rgba(27, 107, 69, 0.2);
		background: #fff;
	}

	.recipe.used {
		border-color: rgba(27, 107, 69, 0.4);
		background: rgba(27, 107, 69, 0.1);
		box-shadow: inset 0 0 0 1px rgba(27, 107, 69, 0.08);
	}

	.recipe.pulse {
		animation: added-pulse 0.7s var(--ease);
	}

	.recipe__emoji {
		width: 2.25rem;
		height: 2.25rem;
		display: grid;
		place-items: center;
		border-radius: 0.65rem;
		background: rgba(27, 107, 69, 0.08);
		font-size: 1.15rem;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.recipe.used .recipe__emoji {
		background: rgba(27, 107, 69, 0.16);
	}

	.recipe__body {
		min-width: 0;
		display: grid;
		gap: 0.05rem;
	}

	.recipe__title {
		font-weight: 600;
		font-size: 0.95rem;
		letter-spacing: -0.02em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.recipe__meta {
		font-size: 0.78rem;
		color: var(--ink-soft);
	}

	.recipe__status {
		color: var(--leaf-deep);
		font-weight: 700;
	}

	.stepper {
		display: inline-flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.15rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.85);
		border: 1px solid rgba(19, 32, 24, 0.1);
	}

	.recipe.used .stepper {
		border-color: rgba(27, 107, 69, 0.28);
		background: rgba(255, 255, 255, 0.95);
	}

	.stepper__btn {
		appearance: none;
		border: none;
		width: 1.55rem;
		height: 1.55rem;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-size: 1rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		color: var(--leaf-deep);
		background: rgba(27, 107, 69, 0.1);
		padding: 0;
	}

	.stepper__btn:hover:not(:disabled) {
		background: rgba(27, 107, 69, 0.2);
	}

	.stepper__btn:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.stepper__value {
		min-width: 1.75rem;
		text-align: center;
		font-size: 0.78rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}

	.form {
		order: 1;
		min-width: 0;
		display: grid;
		gap: 1rem;
	}

	.photo-import {
		padding: 0.85rem;
		border-radius: 1.15rem;
		border: 1.5px dashed rgba(19, 32, 24, 0.12);
		background: rgba(255, 255, 255, 0.4);
	}

	label,
	.drop__field {
		display: grid;
		gap: 0.35rem;
	}

	label span,
	.drop__field span {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	input,
	textarea {
		width: 100%;
		font: inherit;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(19, 32, 24, 0.1);
		border-radius: 0.7rem;
		padding: 0.75rem 0.85rem;
		resize: vertical;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', var(--font-body), sans-serif;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: rgba(27, 107, 69, 0.4);
		background: #fff;
	}

	.drop {
		position: relative;
		display: grid;
		gap: 0.55rem;
		padding: 0.85rem;
		border-radius: 1.15rem;
		border: 1.5px dashed rgba(19, 32, 24, 0.12);
		background: rgba(255, 255, 255, 0.4);
		transition:
			border-color 0.2s var(--ease),
			background 0.2s var(--ease),
			box-shadow 0.2s var(--ease);
	}

	.drop--active {
		border-color: rgba(27, 107, 69, 0.35);
		background: rgba(27, 107, 69, 0.04);
	}

	.drop--over {
		border-color: var(--leaf);
		background: rgba(184, 240, 110, 0.18);
		box-shadow: 0 0 0 3px rgba(27, 107, 69, 0.08);
	}

	.drop__hint {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--ink-soft);
		letter-spacing: 0.02em;
	}

	.drop--over .drop__hint {
		color: var(--leaf-deep);
	}

	.chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.3rem 0.45rem 0.3rem 0.35rem;
		border-radius: 999px;
		background: rgba(27, 107, 69, 0.12);
		border: 1px solid rgba(27, 107, 69, 0.2);
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--leaf-deep);
		max-width: 100%;
	}

	.chip--flash {
		animation: added-pulse 0.7s var(--ease);
	}

	.chip__emoji {
		font-size: 0.95rem;
		line-height: 1;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.chip__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 10rem;
	}

	.stepper--chip {
		margin-left: 0.15rem;
		padding: 0.1rem;
		background: rgba(255, 255, 255, 0.75);
	}

	.stepper--chip .stepper__btn {
		width: 1.35rem;
		height: 1.35rem;
		font-size: 0.9rem;
	}

	.stepper--chip .stepper__value {
		min-width: 1.5rem;
		font-size: 0.72rem;
		color: var(--leaf-deep);
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.75rem;
		padding: 0.8rem 1.1rem;
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

	.btn--primary:hover:not(:disabled) {
		background: var(--leaf-deep);
	}

	.btn--ghost {
		background: transparent;
		border: 1px solid rgba(19, 32, 24, 0.12);
		color: var(--ink-soft);
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(0.65rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes added-pulse {
		0% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(27, 107, 69, 0.35);
		}
		40% {
			transform: scale(1.02);
			box-shadow: 0 0 0 4px rgba(184, 240, 110, 0.45);
		}
		100% {
			transform: scale(1);
			box-shadow: 0 0 0 0 rgba(27, 107, 69, 0);
		}
	}

	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}

		.recipes__list {
			max-height: 14rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page,
		.recipe,
		.chip {
			animation: none;
			transition: none;
		}
	}
</style>
