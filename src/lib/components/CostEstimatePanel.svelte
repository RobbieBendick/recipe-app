<script lang="ts">
	import { onMount } from 'svelte';
	import { ApiError } from '$lib/api';
	import { getUser, updateUser } from '$lib/auth.svelte';
	import {
		estimateCost,
		getEstimateStore,
		saveEstimateStore,
		type CostEstimate,
		type EstimateStore
	} from '$lib/estimates-api';

	type Props = {
		lines: string[];
		title?: string;
	};

	let { lines, title = 'Estimated cost' }: Props = $props();

	let zip = $state('');
	let store = $state<EstimateStore | null>(null);
	let estimate = $state<CostEstimate | null>(null);
	let error = $state('');
	let loadingStore = $state(true);
	let estimating = $state(false);
	let savingZip = $state(false);
	let showDetails = $state(false);

	const usableLines = $derived(lines.map((line) => line.trim()).filter(Boolean));

	onMount(async () => {
		const user = getUser();
		zip = user?.krogerZip?.trim() || '';
		try {
			const lookup = await getEstimateStore(zip || undefined);
			if (lookup.zip) zip = lookup.zip;
			store = lookup.store;
		} catch (e) {
			if (e instanceof ApiError && e.status === 503) {
				error = 'Price estimates need Kroger API credentials on the server.';
			} else {
				error = e instanceof Error ? e.message : 'Failed to load store';
			}
		} finally {
			loadingStore = false;
		}
	});

	async function saveZip(event: Event) {
		event.preventDefault();
		const next = zip.trim();
		if (!next) {
			error = 'Enter a ZIP code near your store.';
			return;
		}
		savingZip = true;
		error = '';
		estimate = null;
		try {
			const lookup = await saveEstimateStore(next);
			zip = lookup.zip || next;
			store = lookup.store;
			if (lookup.user) updateUser(lookup.user);
			if (!lookup.store?.locationId) {
				error = 'Store found but missing locationId — try another ZIP.';
			}
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save store';
		} finally {
			savingZip = false;
		}
	}

	async function runEstimate() {
		if (!usableLines.length) {
			error = 'No ingredients to estimate.';
			return;
		}
		const locationId = store?.locationId?.trim();
		if (!locationId) {
			error = 'Find a store with your ZIP first — prices need that store’s location ID.';
			return;
		}
		estimating = true;
		error = '';
		try {
			estimate = await estimateCost(usableLines, {
				locationId,
				zip: zip.trim()
			});
			if (estimate.store?.locationId) {
				store = { ...store!, ...estimate.store };
			}
			showDetails = true;
		} catch (e) {
			if (e instanceof ApiError && e.status === 400) {
				error = e.message;
			} else if (e instanceof ApiError && e.status === 503) {
				error = 'Price estimates need Kroger API credentials on the server.';
			} else {
				error = e instanceof Error ? e.message : 'Failed to estimate cost';
			}
		} finally {
			estimating = false;
		}
	}

	function money(value: number | undefined) {
		if (value == null || Number.isNaN(value)) return '—';
		return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
	}

	function storeLabel(value: EstimateStore | null) {
		if (!value) return '';
		const name = value.name || value.chain || 'Kroger';
		const place = [value.city, value.state].filter(Boolean).join(', ');
		const base = place ? `${name} · ${place}` : name;
		return value.locationId ? `${base} · ID ${value.locationId}` : base;
	}
</script>

<section class="estimate">
	<div class="estimate__head">
		<h2>{title}</h2>
		{#if estimate}
			<p class="estimate__total">{money(estimate.total)}</p>
		{/if}
	</div>

	<p class="estimate__lede">
		ZIP finds your nearest store, then we price ingredients with that store’s
		<code>locationId</code> (required for Kroger prices).
	</p>

	{#if loadingStore}
		<p class="muted">Loading store…</p>
	{:else}
		<form class="estimate__zip" onsubmit={saveZip}>
			<label>
				<span>ZIP code</span>
				<input
					bind:value={zip}
					type="text"
					inputmode="numeric"
					autocomplete="postal-code"
					placeholder="45202"
					maxlength="10"
				/>
			</label>
			<button type="submit" class="btn btn--ghost" disabled={savingZip}>
				{savingZip ? 'Saving…' : store ? 'Update store' : 'Find store'}
			</button>
		</form>

		{#if store}
			<p class="estimate__store">{storeLabel(store)}</p>
			{#if store.locationId}
				<p class="estimate__store-id">Using locationId <code>{store.locationId}</code> for prices</p>
			{/if}
		{/if}

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button
			type="button"
			class="btn btn--primary"
			onclick={runEstimate}
			disabled={estimating || usableLines.length === 0 || !store?.locationId}
		>
			{estimating ? 'Estimating…' : estimate ? 'Refresh estimate' : 'Estimate cost at this store'}
		</button>

		{#if estimate}
			<button type="button" class="details-toggle" onclick={() => (showDetails = !showDetails)}>
				{showDetails ? 'Hide line details' : 'Show line details'}
			</button>

			{#if showDetails}
				<ul class="lines">
					{#each estimate.lines as line}
						<li class:skipped={line.status !== 'ok'}>
							<div class="line__main">
								<span class="line__input">{line.input}</span>
								<span class="line__cost">
									{#if line.status === 'ok'}
										{money(line.estimate)}
									{:else}
										—
									{/if}
								</span>
							</div>
							{#if line.status === 'ok' && line.productDescription}
								<p class="line__meta">
									{line.productDescription}
									{#if line.productSize}
										· {line.productSize}
									{/if}
									{#if line.productPrice}
										· {money(line.productPrice)} pkg
									{/if}
								</p>
							{:else if line.reason}
								<p class="line__meta">{line.reason}</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</section>

<style>
	.estimate {
		margin-top: 1.75rem;
		padding: 1.15rem 1.2rem 1.2rem;
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(19, 32, 24, 0.08);
		display: grid;
		gap: 0.75rem;
	}

	.estimate__head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
	}

	.estimate__head h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
		letter-spacing: -0.02em;
		margin: 0;
	}

	.estimate__total {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.45rem;
		letter-spacing: -0.03em;
		color: var(--leaf-deep);
		margin: 0;
	}

	.estimate__lede {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.45;
		max-width: 42ch;
	}

	.estimate__zip {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: end;
	}

	.estimate__zip label {
		display: grid;
		gap: 0.3rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink-soft);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.estimate__zip input {
		font: inherit;
		font-size: 1rem;
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		color: var(--ink);
		border: 1.5px solid var(--line);
		border-radius: 0.55rem;
		padding: 0.55rem 0.7rem;
		background: rgba(255, 255, 255, 0.8);
		width: 7.5rem;
	}

	.estimate__store {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		color: var(--leaf-deep);
	}

	.estimate__store-id {
		margin: -0.35rem 0 0;
		font-size: 0.82rem;
		color: var(--ink-soft);
	}

	.estimate__lede code,
	.estimate__store-id code {
		font-size: 0.9em;
	}

	.muted {
		margin: 0;
		color: var(--ink-soft);
	}

	.error {
		margin: 0;
		color: #8a2f2f;
		font-size: 0.92rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.7rem 1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		justify-self: start;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.details-toggle {
		appearance: none;
		border: none;
		background: none;
		padding: 0;
		font: inherit;
		font-size: 0.88rem;
		font-weight: 600;
		color: var(--leaf);
		cursor: pointer;
		justify-self: start;
		text-decoration: underline;
		text-underline-offset: 0.15em;
	}

	.lines {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.55rem;
	}

	.lines li {
		padding: 0.55rem 0.65rem;
		border-radius: 0.65rem;
		background: rgba(27, 107, 69, 0.05);
	}

	.lines li.skipped {
		opacity: 0.62;
		background: rgba(19, 32, 24, 0.04);
	}

	.line__main {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.95rem;
	}

	.line__cost {
		font-weight: 700;
		white-space: nowrap;
	}

	.line__meta {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: var(--ink-soft);
		line-height: 1.35;
	}
</style>
