<script lang="ts">
	import { base } from '$app/paths';
	import { onDestroy, onMount } from 'svelte';
	import { authStore, logout } from '$lib/auth.svelte';
	import { pantryNavStore } from '$lib/pantry-nav-pref.svelte';

	const auth = authStore();
	const pantryNav = pantryNavStore();

	let open = $state(false);
	let rootEl = $state<HTMLDivElement | null>(null);

	const showMyPantry = $derived(
		Boolean(pantryNav.enabled && pantryNav.friendUserId)
	);

	function toggle(e: MouseEvent) {
		e.stopPropagation();
		open = !open;
	}

	function close() {
		open = false;
	}

	function onDocClick(e: MouseEvent) {
		if (!open || !rootEl) return;
		if (!rootEl.contains(e.target as Node)) open = false;
	}

	function onLogout() {
		close();
		logout();
	}

	onMount(() => {
		document.addEventListener('click', onDocClick);
	});

	onDestroy(() => {
		document.removeEventListener('click', onDocClick);
	});
</script>

{#if auth.loggedIn}
	<div class="account" bind:this={rootEl}>
		<button
			type="button"
			class="account__trigger"
			aria-label="Account menu"
			aria-expanded={open}
			aria-haspopup="menu"
			onclick={toggle}
		>
			{#if auth.user?.avatarUrl}
				<img
					class="account__avatar"
					src={auth.user.avatarUrl}
					alt=""
					width="36"
					height="36"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<span class="account__avatar account__avatar--fallback" aria-hidden="true">
					{(auth.user?.name || auth.user?.email || '?').slice(0, 1).toUpperCase()}
				</span>
			{/if}
		</button>

		{#if open}
			<div class="account__menu" role="menu" aria-label="Account">
				<div class="account__who">
					<span class="account__who-name">{auth.user?.name?.trim() || 'Account'}</span>
					<span class="account__who-email">{auth.user?.email}</span>
				</div>
				<div class="account__actions" class:account__actions--three={showMyPantry}>
					{#if showMyPantry}
						<a
							class="icon-btn"
							role="menuitem"
							href="{base}/pantry"
							onclick={close}
							title="My Pantry"
						>
							<span class="icon-btn__glyph" aria-hidden="true">
								<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z" stroke-linejoin="round" />
									<path d="M9 21V12h6v9" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</span>
							<span class="icon-btn__label">My Pantry</span>
						</a>
					{/if}
					<a
						class="icon-btn"
						role="menuitem"
						href="{base}/settings/friends"
						onclick={close}
						title="Friends settings"
					>
						<span class="icon-btn__glyph" aria-hidden="true">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke-linecap="round" />
								<circle cx="9" cy="7" r="4" />
								<path d="M23 21v-2a4 4 0 0 0-3-3.87" stroke-linecap="round" />
								<path d="M16 3.13a4 4 0 0 1 0 7.75" stroke-linecap="round" />
							</svg>
						</span>
						<span class="icon-btn__label">Friends settings</span>
					</a>
					<button
						type="button"
						class="icon-btn icon-btn--danger"
						role="menuitem"
						title="Log out"
						onclick={onLogout}
					>
						<span class="icon-btn__glyph" aria-hidden="true">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke-linecap="round" />
								<path d="M16 17l5-5-5-5" stroke-linecap="round" stroke-linejoin="round" />
								<path d="M21 12H9" stroke-linecap="round" />
							</svg>
						</span>
						<span class="icon-btn__label">Log out</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.account {
		position: relative;
	}

	.account__trigger {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0;
		cursor: pointer;
		border-radius: 50%;
		line-height: 0;
		display: inline-flex;
		transition: transform 0.2s var(--ease);
	}

	.account__trigger:hover {
		transform: scale(1.04);
	}

	.account__trigger[aria-expanded='true'] {
		outline: 2px solid rgba(27, 107, 69, 0.45);
		outline-offset: 2px;
	}

	:global(.shell--home) .account__trigger[aria-expanded='true'] {
		outline-color: rgba(247, 251, 248, 0.55);
	}

	.account__avatar {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 50%;
		object-fit: cover;
		border: 1.5px solid rgba(19, 32, 24, 0.12);
		background: rgba(27, 107, 69, 0.12);
	}

	:global(.shell--home) .account__avatar {
		border-color: rgba(247, 251, 248, 0.35);
	}

	.account__avatar--fallback {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.9rem;
		font-weight: 700;
		color: var(--leaf-deep);
		line-height: 1;
	}

	:global(.shell--home) .account__avatar--fallback {
		color: #f7fbf8;
		background: rgba(247, 251, 248, 0.18);
	}

	.account__menu {
		position: absolute;
		top: calc(100% + 0.55rem);
		right: 0;
		width: min(17.5rem, calc(100vw - 2rem));
		padding: 0.75rem;
		background: #f7fbf8;
		color: var(--ink);
		border: 1.5px solid var(--line);
		border-radius: 1rem;
		box-shadow: 0 14px 36px rgba(19, 32, 24, 0.14);
		z-index: 50;
		animation: pop 0.2s var(--ease) both;
	}

	@keyframes pop {
		from {
			opacity: 0;
			transform: translateY(-6px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.account__who {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding: 0.15rem 0.35rem 0.75rem;
		border-bottom: 1.5px solid var(--line);
		margin-bottom: 0.75rem;
		min-width: 0;
	}

	.account__who-name {
		font-weight: 700;
		font-size: 0.95rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account__who-email {
		font-size: 0.8rem;
		color: var(--ink-soft);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.account__actions {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.45rem;
	}

	.account__actions--three {
		grid-template-columns: repeat(3, 1fr);
	}

	.icon-btn {
		appearance: none;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.7);
		border-radius: 0.85rem;
		padding: 0.7rem 0.35rem 0.55rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.35rem;
		text-decoration: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
		transition:
			background 0.2s var(--ease),
			border-color 0.2s var(--ease),
			transform 0.2s var(--ease);
	}

	.icon-btn:hover {
		background: rgba(27, 107, 69, 0.1);
		border-color: rgba(27, 107, 69, 0.28);
		transform: translateY(-1px);
	}

	.icon-btn--danger:hover {
		background: rgba(180, 58, 58, 0.1);
		border-color: rgba(180, 58, 58, 0.3);
		color: #8a2f2f;
	}

	.icon-btn__glyph {
		display: inline-flex;
		line-height: 0;
		color: var(--leaf-deep);
	}

	.icon-btn--danger .icon-btn__glyph {
		color: #9c2f2f;
	}

	.icon-btn__label {
		font-size: 0.65rem;
		font-weight: 650;
		letter-spacing: 0.01em;
		text-align: center;
		line-height: 1.2;
		max-width: 100%;
	}
</style>
