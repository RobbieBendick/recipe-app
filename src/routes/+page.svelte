<script lang="ts">
	import { base } from '$app/paths';
	import { DEFAULT_TITLE, SITE_NAME } from '$lib/site';
</script>

<svelte:head>
	<title>{DEFAULT_TITLE}</title>
</svelte:head>

<section class="hero" aria-label="Welcome">
	<div class="hero__media" aria-hidden="true">
		<img
			src="{base}/images/hero.jpg"
			alt=""
			width="2400"
			height="1600"
			fetchpriority="high"
		/>
	</div>
	<div class="hero__veil" aria-hidden="true"></div>

	<div class="hero__copy">
		<p class="hero__brand">{SITE_NAME}</p>
		<h1>Cook from a kitchen that remembers.</h1>
		<p class="hero__lede">
			Collect the meals you love, keep them easy to find, and get dinner on the table without the
			scroll.
		</p>
		<div class="hero__actions">
			<a class="btn btn--primary" href="{base}/register">Get started</a>
			<a class="btn btn--ghost" href="{base}/login">Log in</a>
		</div>
	</div>
</section>

<section class="band">
	<div class="band__inner">
		<h2>One place for every dish worth making again.</h2>
		<p>
			Skip the screenshots and scattered tabs. Save recipes, build shopping lists, and keep dinner
			plans in one calm place.
		</p>
	</div>
</section>

<style>
	.hero {
		position: relative;
		isolation: isolate;
		min-height: 100svh;
		display: grid;
		align-items: end;
		overflow: hidden;
		color: #f7fbf8;
	}

	.hero__media {
		position: absolute;
		inset: 0;
		z-index: -2;
		overflow: hidden;
	}

	.hero__media img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center;
		transform: scale(1.08);
		animation: hero-drift 18s var(--ease) both;
	}

	.hero__veil {
		position: absolute;
		inset: 0;
		z-index: -1;
		background:
			linear-gradient(180deg, rgba(10, 22, 16, 0.35) 0%, rgba(10, 22, 16, 0.15) 35%, rgba(10, 22, 16, 0.78) 100%),
			linear-gradient(90deg, rgba(10, 22, 16, 0.55) 0%, rgba(10, 22, 16, 0.15) 55%, transparent 100%);
	}

	.hero__copy {
		width: min(38rem, 100%);
		padding: clamp(5.5rem, 14vh, 8rem) clamp(1.25rem, 4vw, 3rem) clamp(2.5rem, 7vh, 4.5rem);
		animation: rise 0.9s var(--ease) both;
	}

	.hero__brand {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(3.4rem, 11vw, 6.5rem);
		line-height: 0.9;
		letter-spacing: -0.06em;
		margin-bottom: 1.1rem;
		text-shadow: 0 0.15em 0.5em rgba(0, 0, 0, 0.25);
	}

	.hero__copy h1 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.55rem, 3.4vw, 2.15rem);
		letter-spacing: -0.03em;
		line-height: 1.15;
		max-width: 16ch;
		margin-bottom: 0.9rem;
	}

	.hero__lede {
		font-size: clamp(1rem, 2.2vw, 1.12rem);
		color: rgba(247, 251, 248, 0.88);
		max-width: 34ch;
		margin-bottom: 1.75rem;
	}

	.hero__actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		animation: rise 1s 0.12s var(--ease) both;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 0.85rem 1.25rem;
		border-radius: 0.55rem;
		font-weight: 600;
		font-size: 0.95rem;
		text-decoration: none;
		transition:
			transform 0.3s var(--ease),
			background 0.3s var(--ease),
			color 0.3s var(--ease),
			border-color 0.3s var(--ease);
	}

	.btn:hover {
		transform: translateY(-2px);
	}

	.btn--primary {
		background: var(--leaf-bright);
		color: var(--ink);
	}

	.btn--primary:hover {
		background: #c9f78a;
	}

	.btn--ghost {
		border: 1.5px solid rgba(247, 251, 248, 0.55);
		background: rgba(10, 22, 16, 0.2);
		backdrop-filter: blur(6px);
		color: #f7fbf8;
	}

	.btn--ghost:hover {
		border-color: #f7fbf8;
		background: rgba(10, 22, 16, 0.35);
	}

	.band {
		padding: clamp(3.5rem, 10vh, 6rem) clamp(1.25rem, 4vw, 3rem);
	}

	.band__inner {
		max-width: 38rem;
		animation: rise 0.8s 0.05s var(--ease) both;
	}

	.band h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: clamp(1.7rem, 3.5vw, 2.4rem);
		letter-spacing: -0.035em;
		line-height: 1.15;
		margin-bottom: 0.9rem;
		color: var(--ink);
	}

	.band p {
		color: var(--ink-soft);
		font-size: 1.05rem;
		max-width: 40ch;
	}

	@keyframes rise {
		from {
			opacity: 0;
			transform: translateY(1.1rem);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes hero-drift {
		from {
			transform: scale(1.08);
		}
		to {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero__media img,
		.hero__copy,
		.hero__actions,
		.band__inner {
			animation: none;
		}

		.hero__media img {
			transform: none;
		}

		.btn:hover {
			transform: none;
		}
	}
</style>
