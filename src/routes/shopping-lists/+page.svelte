<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { listShoppingLists } from '$lib/shopping-lists-api';
	import { displayEmoji } from '$lib/emoji';
	import { pageTitle } from '$lib/site';
	import type { ShoppingList } from '$lib/types';

	let lists = $state<ShoppingList[]>([]);
	let ready = $state(false);
	let error = $state('');

	onMount(async () => {
		try {
			lists = await listShoppingLists();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load shopping lists';
		} finally {
			ready = true;
		}
	});
</script>

<svelte:head>
	<title>{pageTitle('Shopping lists')}</title>
</svelte:head>

<main class="page">
	<header class="intro">
		<div class="intro__row">
			<h1>Shopping lists</h1>
			<a class="btn" href="{base}/shopping-lists/new">New list</a>
		</div>
		<p class="lede">Build a list from scratch or pull ingredients straight from a recipe.</p>
	</header>

	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if error}
		<p class="error" role="alert">{error}</p>
	{:else if lists.length === 0}
		<div class="empty" role="status">
			<h2>No shopping lists yet</h2>
			<p>Create one for the week, or generate it from a recipe’s ingredients.</p>
			<a class="btn" href="{base}/shopping-lists/new">New shopping list</a>
		</div>
	{:else}
		<ul class="list">
			{#each lists as list (list.id)}
				<li>
					<a class="row" href="{base}/shopping-lists/{list.id}">
						<span class="row__emoji" aria-hidden="true">{displayEmoji(list.emoji, '🛒')}</span>
						<span class="row__title">{list.title}</span>
						<span class="row__meta">
							{list.items.filter((item) => !item.checked).length} left · {list.items.length} total
						</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.page {
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.intro {
		margin-bottom: 2rem;
	}

	.intro__row {
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
		margin-bottom: 0;
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.08rem;
		max-width: 40ch;
	}

	.muted,
	.error {
		color: var(--ink-soft);
	}

	.error {
		color: #8a2f2f;
	}

	.empty {
		border: 1.5px dashed var(--line);
		background: rgba(255, 255, 255, 0.45);
		border-radius: 1rem;
		padding: clamp(2rem, 5vw, 3rem);
		max-width: 28rem;
	}

	.empty h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.45rem;
	}

	.empty p {
		color: var(--ink-soft);
		margin-bottom: 1.35rem;
		max-width: 32ch;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.85rem 1.2rem;
		font: inherit;
		font-weight: 600;
		background: var(--leaf);
		color: #f7fbf8;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.list {
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
	}

	@media (min-width: 540px) {
		.list {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 900px) {
		.list {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (min-width: 1200px) {
		.list {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}

	.row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		grid-template-rows: auto auto;
		align-items: center;
		column-gap: 0.75rem;
		row-gap: 0.2rem;
		padding: 1rem 1.1rem;
		border-radius: 1.15rem;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(19, 32, 24, 0.07);
		text-decoration: none;
		min-width: 0;
		height: 100%;
		backdrop-filter: blur(10px);
		transition:
			background 0.3s var(--ease),
			border-color 0.3s var(--ease),
			transform 0.25s var(--ease);
	}

	.row__emoji {
		grid-row: 1 / 3;
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		font-size: 1.35rem;
		line-height: 1;
		background: rgba(27, 107, 69, 0.08);
		border-radius: 0.85rem;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.row:hover {
		background: rgba(255, 255, 255, 0.78);
		border-color: rgba(27, 107, 69, 0.18);
		transform: translateY(-1px);
	}

	.row__title {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.1rem;
		letter-spacing: -0.02em;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.row__meta {
		color: var(--ink-soft);
		font-size: 0.85rem;
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
