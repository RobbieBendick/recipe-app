<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { onDestroy, onMount } from 'svelte';
	import { authStore, hydrateAuth } from '$lib/auth.svelte';
	import AccountMenu from '$lib/components/AccountMenu.svelte';
	import NotificationBell from '$lib/components/NotificationBell.svelte';
	import { hydratePantryNavPref, pantryNavStore } from '$lib/pantry-nav-pref.svelte';
	import { DEFAULT_TITLE, SITE_NAME } from '$lib/site';

	let { children } = $props();

	const auth = authStore();
	const pantryNav = pantryNavStore();
	const path = $derived(page.url.pathname.replace(/\/$/, '') || '/');
	const isHome = $derived(path === base || path === `${base}/` || path === '/');

	const protectedPrefixes = ['/your-recipes', '/shopping-lists', '/pantry', '/friends', '/settings'];
	const pathWithoutBase = $derived(
		base && path.startsWith(base) ? path.slice(base.length) || '/' : path
	);
	const isProtected = $derived(
		protectedPrefixes.some(
			(prefix) => pathWithoutBase === prefix || pathWithoutBase.startsWith(`${prefix}/`)
		)
	);
	const isAuthPage = $derived(path.endsWith('/login') || path.endsWith('/register'));

	const pantryHref = $derived(
		pantryNav.enabled && pantryNav.friendUserId
			? `${base}/pantry?friend=${encodeURIComponent(pantryNav.friendUserId)}`
			: `${base}/pantry`
	);

	let menuOpen = $state(false);
	let headerEl = $state<HTMLElement | null>(null);

	function closeMenu() {
		menuOpen = false;
	}

	function toggleMenu(e: MouseEvent) {
		e.stopPropagation();
		menuOpen = !menuOpen;
	}

	function onDocClick(e: MouseEvent) {
		if (!menuOpen || !headerEl) return;
		if (!headerEl.contains(e.target as Node)) {
			menuOpen = false;
		}
	}

	onMount(() => {
		hydrateAuth();
		document.addEventListener('click', onDocClick);
	});

	onDestroy(() => {
		document.removeEventListener('click', onDocClick);
	});

	$effect(() => {
		if (!auth.ready) return;
		hydratePantryNavPref(auth.loggedIn ? auth.user?.id : null);
	});

	$effect(() => {
		// Close the mobile menu whenever the route changes.
		path;
		menuOpen = false;
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
		href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Caveat:wght@600;700&family=Onest:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
	<title>{DEFAULT_TITLE}</title>
</svelte:head>

<div class="shell" class:shell--home={isHome}>
	<header class="top" bind:this={headerEl}>
		<a class="brand" href="{base}/" onclick={closeMenu}>{SITE_NAME}</a>

		{#if auth.loggedIn || !isAuthPage}
			<div
				id="site-menu"
				class="menu"
				class:menu--open={menuOpen}
			>
				{#if auth.loggedIn}
					<nav class="nav" aria-label="Primary">
						<a
							href="{base}/your-recipes"
							class:active={path.includes('/your-recipes')}
							onclick={closeMenu}
						>
							<span class="nav__ico" aria-hidden="true">🍽️</span> Recipes
						</a>
						<a
							href="{base}/shopping-lists"
							class:active={path.includes('/shopping-lists')}
							onclick={closeMenu}
						>
							<span class="nav__ico" aria-hidden="true">🛒</span> Shopping
						</a>
						<a href={pantryHref} class:active={path.includes('/pantry')} onclick={closeMenu}>
							<span class="nav__ico" aria-hidden="true">🏠</span> Pantry
						</a>
						<a
							href="{base}/friends"
							class:active={pathWithoutBase === '/friends' || pathWithoutBase.startsWith('/friends/')}
							onclick={closeMenu}
						>
							<span class="nav__ico" aria-hidden="true">👥</span> Friends
						</a>
					</nav>
				{/if}

				{#if !auth.loggedIn}
					<div class="menu__account">
						<a
							class="nav__login"
							href="{base}/login"
							class:active={path.endsWith('/login')}
							onclick={closeMenu}>Log in</a
						>
						<a href="{base}/register" class="nav__cta" onclick={closeMenu}>Sign up</a>
					</div>
				{/if}
			</div>
		{/if}

		<div class="top__tools">
			{#if auth.loggedIn}
				<NotificationBell />
				<AccountMenu />
			{/if}

			{#if auth.loggedIn || !isAuthPage}
				<button
					type="button"
					class="menu-btn"
					aria-label={menuOpen ? 'Close menu' : 'Open menu'}
					aria-expanded={menuOpen}
					aria-controls="site-menu"
					onclick={toggleMenu}
				>
					<span class="menu-btn__bars" class:menu-btn__bars--open={menuOpen} aria-hidden="true"></span>
				</button>
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
		--font-script: 'Caveat', 'Segoe Print', cursive;
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
		gap: 0.75rem 1.25rem;
		padding: 1.15rem clamp(1.25rem, 4vw, 3rem);
		position: relative;
		z-index: 30;
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
		position: relative;
		z-index: 2;
		flex-shrink: 0;
	}

	.brand:hover {
		opacity: 0.75;
	}

	.top__tools {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		position: relative;
		z-index: 2;
		flex-shrink: 0;
	}

	.menu-btn {
		display: none;
		appearance: none;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.65rem;
		align-items: center;
		justify-content: center;
		opacity: 0.9;
	}

	.menu-btn:hover {
		background: var(--mist);
	}

	.shell--home .menu-btn:hover {
		background: rgba(247, 251, 248, 0.16);
	}

	.menu-btn__bars,
	.menu-btn__bars::before,
	.menu-btn__bars::after {
		display: block;
		width: 1.15rem;
		height: 2px;
		background: currentColor;
		border-radius: 2px;
		transition:
			transform 0.25s var(--ease),
			opacity 0.2s var(--ease);
	}

	.menu-btn__bars {
		position: relative;
	}

	.menu-btn__bars::before,
	.menu-btn__bars::after {
		content: '';
		position: absolute;
		left: 0;
	}

	.menu-btn__bars::before {
		top: -6px;
	}

	.menu-btn__bars::after {
		top: 6px;
	}

	.menu-btn__bars--open {
		background: transparent;
	}

	.menu-btn__bars--open::before {
		top: 0;
		transform: rotate(45deg);
	}

	.menu-btn__bars--open::after {
		top: 0;
		transform: rotate(-45deg);
	}

	.menu {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem 1.5rem;
		min-width: 0;
		flex: 1;
		margin-right: 0.25rem;
	}

	.nav {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 0.35rem 1.1rem;
	}

	.menu__account {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-shrink: 0;
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

	.boot {
		padding: 3rem clamp(1.25rem, 4vw, 3rem);
		color: var(--ink-soft);
	}

	@media (max-width: 820px) {
		.menu-btn {
			display: inline-flex;
		}

		.top__tools {
			margin-left: auto;
		}

		.menu {
			display: none;
			position: absolute;
			top: calc(100% - 0.35rem);
			left: 1rem;
			right: 1rem;
			flex: none;
			margin-right: 0;
			flex-direction: column;
			align-items: stretch;
			flex-wrap: nowrap;
			gap: 0;
			padding: 0.65rem;
			background: #f7fbf8;
			color: var(--ink);
			border: 1.5px solid var(--line);
			border-radius: 1rem;
			box-shadow: 0 16px 40px rgba(19, 32, 24, 0.14);
			animation: menu-in 0.22s var(--ease) both;
		}

		.menu--open {
			display: flex;
		}

		.shell--home .menu {
			background: rgba(247, 251, 248, 0.97);
		}

		.nav {
			flex-direction: column;
			align-items: stretch;
			gap: 0.15rem;
			width: 100%;
		}

		.nav a {
			opacity: 1;
			padding: 0.75rem 0.8rem;
			border-radius: 0.7rem;
			font-weight: 600;
		}

		.nav a.active {
			background: var(--mist);
			color: var(--leaf-deep);
		}

		.nav a::after,
		.nav__login::after {
			display: none;
		}

		.menu__account {
			flex-direction: column;
			align-items: stretch;
			gap: 0.55rem;
			margin-top: 0.45rem;
			padding-top: 0.65rem;
			border-top: 1.5px solid var(--line);
		}

		.nav__login,
		.nav__cta {
			text-align: center;
			padding: 0.7rem 0.8rem !important;
			border-radius: 0.7rem;
			width: 100%;
		}

		.nav__login {
			opacity: 1;
			border: 1.5px solid var(--line);
			justify-content: center;
		}

		.nav__cta {
			justify-content: center;
		}
	}

	@keyframes menu-in {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
