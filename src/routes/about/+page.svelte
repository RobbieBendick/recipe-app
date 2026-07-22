<script lang="ts">
	import { base } from '$app/paths';
	import { pageTitle, SITE_NAME } from '$lib/site';
</script>

<svelte:head>
	<title>{pageTitle('About')}</title>
</svelte:head>

<main class="page">
	<h1>A quieter way to keep what you cook.</h1>
	<p class="lede">
		{SITE_NAME} is a simple home for the recipes you actually make — not another feed of dishes you
		might try someday.
	</p>
	<p>
		Save favorites, build shopping lists from ingredients, and keep a collection that feels like your
		kitchen: personal, useful, and ready when hunger hits.
	</p>
	<a class="link" href="{base}/login">Browse your recipes →</a>
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
		font-size: clamp(2rem, 5vw, 3rem);
		letter-spacing: -0.045em;
		line-height: 1.05;
		margin-bottom: 1.1rem;
		max-width: 14ch;
	}

	.lede {
		font-size: 1.15rem;
		color: var(--ink-soft);
		margin-bottom: 1rem;
		max-width: 38ch;
	}

	p {
		color: var(--ink-soft);
		margin-bottom: 1rem;
		max-width: 42ch;
	}

	.link {
		display: inline-block;
		margin-top: 1rem;
		font-weight: 600;
		color: var(--leaf-deep);
		text-decoration: none;
		border-bottom: 1.5px solid currentColor;
		padding-bottom: 0.1rem;
		transition: color 0.25s var(--ease);
	}

	.link:hover {
		color: var(--leaf);
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
