<script lang="ts">
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import GoogleSignIn from '$lib/components/GoogleSignIn.svelte';
	import { login, loginWithGoogle } from '$lib/auth-api';
	import { authStore, hydrateAuth } from '$lib/auth.svelte';
	import { ApiError } from '$lib/api';
	import { pageTitle } from '$lib/site';

	const auth = authStore();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	onMount(() => {
		hydrateAuth();
		if (auth.loggedIn) {
			goto(`${base}/your-recipes`);
		}
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();
		error = '';
		busy = true;
		try {
			await login(email.trim(), password);
			goto(`${base}/your-recipes`);
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Login failed';
		} finally {
			busy = false;
		}
	}

	async function handleGoogle(idToken: string) {
		error = '';
		busy = true;
		try {
			await loginWithGoogle(idToken);
			goto(`${base}/your-recipes`);
		} catch (e) {
			error = e instanceof ApiError ? e.message : 'Google sign-in failed';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle('Log in')}</title>
</svelte:head>

<main class="page">
	<header class="intro">
		<h1>Welcome back</h1>
		<p class="lede">Log in to your recipes, lists, and pantry.</p>
	</header>

	<form class="card" onsubmit={handleSubmit}>
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<label>
			<span>Email</span>
			<input bind:value={email} type="email" autocomplete="email" required disabled={busy} />
		</label>
		<label>
			<span>Password</span>
			<input
				bind:value={password}
				type="password"
				autocomplete="current-password"
				required
				disabled={busy}
			/>
		</label>

		<button type="submit" class="btn" disabled={busy}>
			{busy ? 'Signing in…' : 'Log in'}
		</button>

		<div class="divider"><span>or</span></div>

		<GoogleSignIn onCredential={handleGoogle} disabled={busy} />

		<p class="switch">
			New here? <a href="{base}/register">Create an account</a>
		</p>
	</form>
</main>

<style>
	.page {
		width: min(26rem, 100%);
		margin-inline: auto;
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.intro {
		margin-bottom: 1.5rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.6rem);
		letter-spacing: -0.045em;
		margin-bottom: 0.45rem;
	}

	.lede {
		color: var(--ink-soft);
	}

	.card {
		display: grid;
		gap: 0.9rem;
		padding: 1.25rem;
		border-radius: 1.15rem;
		background: rgba(255, 255, 255, 0.6);
		border: 1px solid rgba(19, 32, 24, 0.07);
		backdrop-filter: blur(10px);
	}

	.error {
		color: #8a2f2f;
		background: rgba(138, 47, 47, 0.08);
		border-radius: 0.65rem;
		padding: 0.65rem 0.8rem;
		font-size: 0.92rem;
	}

	label {
		display: grid;
		gap: 0.3rem;
	}

	label span {
		font-weight: 600;
		font-size: 0.8rem;
		color: var(--ink-soft);
	}

	label input {
		font: inherit;
		padding: 0.75rem 0.85rem;
		border-radius: 0.7rem;
		border: 1px solid rgba(19, 32, 24, 0.1);
		background: rgba(255, 255, 255, 0.8);
	}

	label input:focus {
		outline: none;
		border-color: rgba(27, 107, 69, 0.4);
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.75rem;
		padding: 0.8rem 1.1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn:hover:not(:disabled) {
		background: var(--leaf-deep);
	}

	.divider {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 0.75rem;
		color: var(--ink-soft);
		font-size: 0.85rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		height: 1px;
		background: var(--line);
	}

	.switch {
		text-align: center;
		font-size: 0.92rem;
		color: var(--ink-soft);
	}

	.switch a {
		color: var(--leaf-deep);
		font-weight: 600;
		text-decoration: none;
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
</style>
