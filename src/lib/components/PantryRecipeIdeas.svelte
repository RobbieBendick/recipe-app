<script lang="ts">
	import { base } from '$app/paths';
	import { displayEmoji } from '$lib/emoji';
	import {
		almostRecipes,
		matchRecipesToPantry,
		readyRecipes,
		type RecipePantryMatch
	} from '$lib/pantry-match';
	import type { PantryItem, Recipe } from '$lib/types';

	let {
		items,
		recipes,
		loading = false
	}: {
		items: PantryItem[];
		recipes: Recipe[];
		loading?: boolean;
	} = $props();

	let expandedId = $state('');

	const matches = $derived(matchRecipesToPantry(recipes, items));
	const ready = $derived(readyRecipes(matches));
	const almost = $derived(almostRecipes(matches));

	function toggleExpand(id: string) {
		expandedId = expandedId === id ? '' : id;
	}
</script>

<section class="ideas" aria-labelledby="cook-heading">
	<div class="ideas__head">
		<h2 id="cook-heading">Cook with what you have</h2>
		<p class="ideas__lede">
			Recipes you can make now, or almost — based on what’s marked in stock.
		</p>
	</div>

	{#if loading}
		<p class="muted">Checking your recipes…</p>
	{:else if recipes.length === 0}
		<p class="muted">
			Add some recipes on
			<a class="text-link" href="{base}/your-recipes">Your recipes</a>
			to get suggestions here.
		</p>
	{:else if ready.length === 0 && almost.length === 0}
		<p class="muted">
			No strong matches yet. Mark more staples as in stock, or add recipes that use them.
		</p>
	{:else}
		{#if ready.length > 0}
			<h3 class="ideas__sub">Ready to cook</h3>
			<ul class="ideas__list">
				{#each ready as match (match.recipe.id)}
					{@render card(match, true)}
				{/each}
			</ul>
		{/if}

		{#if almost.length > 0}
			<h3 class="ideas__sub">Almost there</h3>
			<ul class="ideas__list">
				{#each almost as match (match.recipe.id)}
					{@render card(match, false)}
				{/each}
			</ul>
		{/if}
	{/if}
</section>

{#snippet card(match: RecipePantryMatch, isReady: boolean)}
	<li class="card" class:card--ready={isReady}>
		<div class="card__row">
			<a class="card__main" href="{base}/your-recipes/{match.recipe.id}">
				<span class="card__emoji" aria-hidden="true">{displayEmoji(match.recipe.emoji)}</span>
				<span class="card__text">
					<span class="card__title">{match.recipe.title}</span>
					<span class="card__meta">
						{#if isReady}
							All {match.total} ingredients in pantry
						{:else}
							{match.haveCount}/{match.total} in pantry · missing {match.missingCount}
						{/if}
					</span>
				</span>
			</a>
			<button
				type="button"
				class="card__toggle"
				aria-expanded={expandedId === match.recipe.id}
				onclick={() => toggleExpand(match.recipe.id)}
			>
				{expandedId === match.recipe.id ? 'Hide' : 'Details'}
			</button>
		</div>

		{#if expandedId === match.recipe.id}
			<div class="breakdown">
				<div class="breakdown__col">
					<p class="breakdown__label">Have</p>
					<ul>
						{#each match.ingredients.filter((i) => i.have) as ing}
							<li class="have">{ing.line}</li>
						{:else}
							<li class="empty">None fully covered</li>
						{/each}
					</ul>
				</div>
				<div class="breakdown__col">
					<p class="breakdown__label">Need</p>
					<ul>
						{#each match.ingredients.filter((i) => !i.have) as ing}
							<li class="need">
								{ing.line}
								{#if ing.note}
									<span class="need__note">({ing.note})</span>
								{/if}
							</li>
						{:else}
							<li class="empty">Nothing missing</li>
						{/each}
					</ul>
				</div>
			</div>
		{/if}
	</li>
{/snippet}

<style>
	.ideas {
		margin-bottom: 2rem;
		padding: 1.15rem 1.2rem 1.25rem;
		border: 1.5px solid var(--line);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.45);
	}

	.ideas__head {
		margin-bottom: 1rem;
	}

	.ideas h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.3rem;
	}

	.ideas__lede {
		color: var(--ink-soft);
		font-size: 0.95rem;
		line-height: 1.4;
	}

	.ideas__sub {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.02rem;
		letter-spacing: -0.02em;
		margin: 1rem 0 0.55rem;
		color: var(--leaf-deep);
	}

	.ideas__list {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}

	.card {
		border: 1.5px solid var(--line);
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.65);
		padding: 0.65rem 0.75rem;
	}

	.card--ready {
		border-color: rgba(27, 107, 69, 0.28);
		background: rgba(232, 244, 236, 0.75);
	}

	.card__row {
		display: flex;
		align-items: center;
		gap: 0.55rem;
	}

	.card__main {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		flex: 1;
		text-decoration: none;
		color: inherit;
	}

	.card__emoji {
		font-size: 1.35rem;
		line-height: 1;
		flex-shrink: 0;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.card__text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.card__title {
		font-weight: 700;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.card__meta {
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	.card__toggle {
		appearance: none;
		border: 1.5px solid var(--line);
		background: transparent;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 650;
		color: var(--ink-soft);
		padding: 0.4rem 0.65rem;
		border-radius: 0.55rem;
		cursor: pointer;
		flex-shrink: 0;
	}

	.card__toggle:hover {
		color: var(--leaf-deep);
		border-color: rgba(27, 107, 69, 0.28);
		background: rgba(27, 107, 69, 0.08);
	}

	.breakdown {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.75rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1.5px solid var(--line);
	}

	.breakdown__label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-soft);
		margin-bottom: 0.35rem;
	}

	.breakdown ul {
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.breakdown li {
		font-size: 0.86rem;
		line-height: 1.35;
	}

	.have {
		color: var(--leaf-deep);
	}

	.need {
		color: #8a2f2f;
	}

	.need__note {
		display: inline;
		margin-left: 0.25rem;
		font-weight: 600;
		color: var(--ink-soft);
	}

	.empty {
		color: var(--ink-soft);
		font-style: italic;
	}

	.muted {
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.text-link {
		color: var(--leaf-deep);
		font-weight: 600;
	}

	@media (max-width: 520px) {
		.breakdown {
			grid-template-columns: 1fr;
		}
	}
</style>
