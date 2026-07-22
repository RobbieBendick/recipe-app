<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { authStore, hydrateAuth, logout } from '$lib/auth.svelte';
	import { DEFAULT_TITLE, SITE_NAME } from '$lib/site';

	let { children } = $props();

	const auth = authStore();
	const path = $derived(page.url.pathname.replace(/\/$/, '') || '/');
	const isHome = $derived(path === base || path === `${base}/` || path === '/');

	const protectedPrefixes = ['/your-recipes', '/shopping-lists', '/pantry'];
	const isProtected = $derived(
		protectedPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
	);
	const isAuthPage = $derived(path.endsWith('/login') || path.endsWith('/register'));

	onMount(() => {
		hydrateAuth();
	});

	$effect(() => {
		if (!auth.ready) return;
		if (isProtected && !auth.loggedIn) {
			goto(`${base}/login`);
		}
	});
</script>

<svelte:head>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Onest:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
	<title>{DEFAULT_TITLE}</title>
</svelte:head>

<div class="shell" class:shell--home={isHome}>
	<header class="top">
		<a class="brand" href="{base}/">{SITE_NAME}</a>

		<div class="top__right">
			<nav class="nav" aria-label="Primary">
				{#if auth.loggedIn}
					<a href="{base}/your-recipes" class:active={path.includes('/your-recipes')}>
						<span class="nav__ico" aria-hidden="true">🍽️</span> Recipes
					</a>
					<a href="{base}/shopping-lists" class:active={path.includes('/shopping-lists')}>
						<span class="nav__ico" aria-hidden="true">🛒</span> Shopping
					</a>
					<a href="{base}/pantry" class:active={path.includes('/pantry')}>
						<span class="nav__ico" aria-hidden="true">🏠</span> Pantry
					</a>
				{/if}
			</nav>

			{#if auth.loggedIn || !isAuthPage}
				<div class="top__account">
					{#if auth.loggedIn}
						<span class="nav__user" title={auth.user?.email || auth.user?.name || 'Account'}>
							{#if auth.user?.avatarUrl}
								<img
									class="nav__avatar"
									src={auth.user.avatarUrl}
									alt=""
									width="32"
									height="32"
									referrerpolicy="no-referrer"
								/>
							{:else}
								<span class="nav__avatar nav__avatar--fallback" aria-hidden="true">
									{(auth.user?.name || auth.user?.email || '?').slice(0, 1).toUpperCase()}
								</span>
							{/if}
						</span>
						<button type="button" class="nav__logout" onclick={() => logout()}>Log out</button>
					{:else}
						<a class="nav__login" href="{base}/login" class:active={path.endsWith('/login')}
							>Log in</a
						>
						<a href="{base}/register" class="nav__cta">Sign up</a>
					{/if}
				</div>
			{/if}
		</div>
	</header>

	{#if isProtected && !auth.ready}
		<p class="boot">Loading…</p>
	{:else if isProtected && !auth.loggedIn}
		<p class="boot">Redirecting to login…</p>
	{:else}
		{@render children()}
	{/if}
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(:root) {
		--ink: #132018;
		--ink-soft: #3d5247;
		--paper: #f2f6f3;
		--paper-deep: #e4eee7;
		--leaf: #1b6b45;
		--leaf-deep: #124f32;
		--leaf-bright: #b8f06e;
		--mist: rgba(27, 107, 69, 0.1);
		--line: rgba(19, 32, 24, 0.1);
		--font-display: 'Bricolage Grotesque', Georgia, serif;
		--font-body: 'Onest', system-ui, sans-serif;
		--ease: cubic-bezier(0.22, 1, 0.36, 1);
	}

	:global(html) {
		scroll-behavior: smooth;
	}

	:global(body) {
		font-family: var(--font-body);
		color: var(--ink);
		background:
			radial-gradient(1200px 600px at 10% -10%, rgba(184, 240, 110, 0.22), transparent 55%),
			radial-gradient(900px 500px at 100% 0%, rgba(27, 107, 69, 0.12), transparent 50%),
			linear-gradient(180deg, var(--paper) 0%, var(--paper-deep) 100%);
		background-attachment: fixed;
		min-height: 100vh;
		-webkit-font-smoothing: antialiased;
		line-height: 1.5;
	}

	:global(.emoji),
	:global(.nav__ico) {
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
		font-style: normal;
		line-height: 1;
	}

	:global(a) {
		color: inherit;
	}

	:global(img) {
		max-width: 100%;
		display: block;
	}

	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem 1.5rem;
		padding: 1.15rem clamp(1.25rem, 4vw, 3rem);
		position: relative;
		z-index: 10;
	}

	.top__right {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem 1.75rem;
		min-width: 0;
	}

	.top__account {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
	}

	.shell--home .top {
		position: absolute;
		inset: 0 0 auto;
		width: 100%;
		color: #f7fbf8;
	}

	.brand {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.04em;
		text-decoration: none;
		transition: opacity 0.25s var(--ease);
	}

	.brand:hover {
		opacity: 0.75;
	}

	.nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem 1.1rem;
	}

	.nav a,
	.nav__login {
		font-size: 0.92rem;
		font-weight: 500;
		text-decoration: none;
		position: relative;
		padding: 0.2rem 0;
		opacity: 0.78;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		transition:
			opacity 0.25s var(--ease),
			color 0.25s var(--ease);
	}

	.nav__ico {
		font-size: 1rem;
	}

	.nav a:hover,
	.nav a.active,
	.nav__login:hover,
	.nav__login.active {
		opacity: 1;
	}

	.nav a::after,
	.nav__login::after {
		content: '';
		position: absolute;
		left: 0;
		bottom: -0.15rem;
		width: 100%;
		height: 1.5px;
		background: currentColor;
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.35s var(--ease);
	}

	.nav a:hover::after,
	.nav a.active::after,
	.nav__login:hover::after,
	.nav__login.active::after {
		transform: scaleX(1);
	}

	.nav__cta {
		opacity: 1 !important;
		padding: 0.45rem 0.85rem !important;
		border-radius: 0.65rem;
		background: var(--leaf);
		color: #f7fbf8 !important;
		font-size: 0.92rem;
		font-weight: 600;
		text-decoration: none;
	}

	.shell--home .nav__cta {
		background: var(--leaf-bright);
		color: var(--ink) !important;
	}

	.nav__user {
		display: inline-flex;
		align-items: center;
		line-height: 0;
	}

	.nav__avatar {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		object-fit: cover;
		border: 1.5px solid rgba(19, 32, 24, 0.12);
		background: rgba(27, 107, 69, 0.12);
	}

	.shell--home .nav__avatar {
		border-color: rgba(247, 251, 248, 0.35);
	}

	.nav__avatar--fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.85rem;
		font-weight: 700;
		color: var(--leaf-deep);
		line-height: 1;
	}

	.shell--home .nav__avatar--fallback {
		color: #f7fbf8;
		background: rgba(247, 251, 248, 0.18);
	}

	.nav__logout {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		color: inherit;
		cursor: pointer;
		opacity: 0.75;
		padding: 0.2rem 0;
	}

	.nav__logout:hover {
		opacity: 1;
	}

	.boot {
		padding: 3rem clamp(1.25rem, 4vw, 3rem);
		color: var(--ink-soft);
	}

	@media (max-width: 560px) {
		.top {
			flex-wrap: wrap;
			align-items: flex-start;
		}

		.top__right {
			width: 100%;
			justify-content: flex-start;
		}
	}
</style>
