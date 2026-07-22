<script lang="ts">
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';

	type Props = {
		onCredential: (idToken: string) => void | Promise<void>;
		disabled?: boolean;
	};

	let { onCredential, disabled = false }: Props = $props();

	let host = $state<HTMLDivElement | null>(null);
	let error = $state('');
	const clientId = $derived(env.PUBLIC_GOOGLE_CLIENT_ID?.trim() || '');

	onMount(() => {
		if (!clientId || !host) return;

		const existing = document.getElementById('google-gsi');
		const init = () => {
			const google = (window as unknown as { google?: GoogleGsi }).google;
			if (!google?.accounts?.id || !host) return;
			google.accounts.id.initialize({
				client_id: clientId,
				callback: (response) => {
					if (response.credential) {
						void onCredential(response.credential);
					}
				}
			});
			google.accounts.id.renderButton(host, {
				theme: 'outline',
				size: 'large',
				width: host.offsetWidth || 320,
				text: 'continue_with',
				shape: 'rectangular'
			});
		};

		if (existing) {
			init();
			return;
		}

		const script = document.createElement('script');
		script.id = 'google-gsi';
		script.src = 'https://accounts.google.com/gsi/client';
		script.async = true;
		script.defer = true;
		script.onload = init;
		script.onerror = () => {
			error = 'Could not load Google Sign-In.';
		};
		document.head.appendChild(script);
	});
</script>

{#if clientId}
	<div class="google">
		<div class="google__btn" bind:this={host} class:disabled></div>
		{#if error}
			<p class="error">{error}</p>
		{/if}
	</div>
{:else}
	<p class="hint">Google Sign-In isn’t configured yet.</p>
{/if}

<style>
	.google {
		width: 100%;
	}

	.google__btn {
		width: 100%;
		min-height: 2.75rem;
		display: flex;
		justify-content: center;
	}

	.google__btn.disabled {
		pointer-events: none;
		opacity: 0.55;
	}

	.error {
		color: #8a2f2f;
		font-size: 0.9rem;
		margin-top: 0.5rem;
	}

	.hint {
		color: var(--ink-soft);
		font-size: 0.88rem;
		text-align: center;
	}
</style>
