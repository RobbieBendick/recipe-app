<script lang="ts">
	import { onMount } from 'svelte';
	import { ApiError } from '$lib/api';
	import {
		estimateCost,
		getEstimateStore,
		listEstimateProducts,
		type CostEstimate,
		type EstimateLine,
		type EstimateStore,
		type ProductOption
	} from '$lib/estimates-api';
	import { overridesForEstimate, saveProductOverride } from '$lib/estimate-overrides';

	/** Fixed store area for all price estimates. */
	const ESTIMATE_ZIP = '45202';

	type Props = {
		lines: string[];
		title?: string;
		/** Stable key so product picks survive refresh (e.g. recipe:uuid). */
		persistKey?: string;
		/**
		 * portion = cost of amount used (recipes).
		 * packages = round up to whole packages to buy (shopping lists).
		 */
		pricing?: 'portion' | 'packages';
	};

	let {
		lines,
		title = 'Estimated cost',
		persistKey = '',
		pricing = 'portion'
	}: Props = $props();

	let store = $state<EstimateStore | null>(null);
	let estimate = $state<CostEstimate | null>(null);
	let error = $state('');
	let loadingStore = $state(true);
	let estimating = $state(false);
	let showDetails = $state(false);

	let pickerLineIndex = $state<number | null>(null);
	let pickerOptions = $state<ProductOption[]>([]);
	let pickerSearchTerm = $state('');
	let pickerLoading = $state(false);
	let pickerError = $state('');
	let dialogEl = $state<HTMLDialogElement | null>(null);

	const usableLines = $derived(lines.map((line) => line.trim()).filter(Boolean));
	const pickerOpen = $derived(pickerLineIndex !== null);

	onMount(async () => {
		try {
			const lookup = await getEstimateStore(ESTIMATE_ZIP);
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

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (pickerOpen && !el.open) el.showModal();
		if (!pickerOpen && el.open) el.close();
	});

	async function runEstimate() {
		if (!usableLines.length) {
			error = 'No ingredients to estimate.';
			return;
		}
		estimating = true;
		error = '';
		try {
			estimate = await estimateCost(usableLines, {
				locationId: store?.locationId?.trim() || undefined,
				zip: ESTIMATE_ZIP,
				overrides: persistKey ? overridesForEstimate(persistKey, usableLines) : [],
				pricing
			});
			if (estimate.store?.locationId) {
				store = { ...(store ?? estimate.store), ...estimate.store };
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

	async function openPicker(index: number) {
		if (!estimate) return;
		const line = estimate.lines[index];
		if (!line) return;
		pickerLineIndex = index;
		pickerOptions = [];
		pickerSearchTerm = line.searchTerm || '';
		pickerError = '';
		await searchPickerProducts(line.input, pickerSearchTerm);
	}

	async function searchPickerProducts(lineInput: string, term: string) {
		pickerLoading = true;
		pickerError = '';
		pickerOptions = [];
		try {
			const trimmed = term.trim();
			if (trimmed && trimmed.length < 3) {
				pickerError = 'Search term must be at least 3 characters.';
				return;
			}
			const result = await listEstimateProducts(lineInput, {
				locationId: store?.locationId?.trim() || estimate?.locationId || undefined,
				zip: ESTIMATE_ZIP,
				searchTerm: trimmed || undefined,
				pricing
			});
			pickerSearchTerm = result.searchTerm || trimmed;
			pickerOptions = result.options;
			if (!result.options.length) {
				pickerError = 'No priced products found for this search.';
			}
		} catch (e) {
			pickerError = e instanceof Error ? e.message : 'Failed to load products';
		} finally {
			pickerLoading = false;
		}
	}

	function submitPickerSearch(event: Event) {
		event.preventDefault();
		if (!activeLine || pickerLoading) return;
		void searchPickerProducts(activeLine.input, pickerSearchTerm);
	}

	function closePicker() {
		pickerLineIndex = null;
		pickerOptions = [];
		pickerError = '';
		pickerLoading = false;
	}

	function applyOption(option: ProductOption) {
		if (!estimate || pickerLineIndex === null) return;
		const index = pickerLineIndex;
		const prev = estimate.lines[index];
		if (!prev) return;

		const nextLine: EstimateLine = {
			...prev,
			status: 'ok',
			reason: undefined,
			searchTerm: pickerSearchTerm.trim() || prev.searchTerm,
			productId: option.productId,
			productDescription: option.description,
			productSize: option.size,
			productPrice: option.price,
			estimate: option.estimate,
			packagesNeeded: option.packagesNeeded,
			unitPricePerGram: option.unitPricePerGram,
			unitPricePerCount: option.unitPricePerCount
		};

		if (persistKey) {
			saveProductOverride(persistKey, prev.input, {
				productId: option.productId,
				searchTerm: nextLine.searchTerm
			});
		}

		const nextLines = estimate.lines.map((line, i) => (i === index ? nextLine : line));
		const total = roundMoney(
			nextLines.reduce((sum, line) => (line.status === 'ok' ? sum + (line.estimate ?? 0) : sum), 0)
		);
		estimate = { ...estimate, lines: nextLines, total };
		closePicker();
	}

	function money(value: number | undefined) {
		if (value == null || Number.isNaN(value)) return '—';
		return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
	}

	function roundMoney(value: number) {
		return Math.round(value * 100) / 100;
	}

	/** e.g. "$0.61/oz ($6.99)" from package size + price. */
	function unitAndBundle(price: number | undefined, size: string | undefined): string {
		if (price == null || Number.isNaN(price) || price <= 0) return '—';
		const bundle = money(price);
		const parsed = parsePackageAmount(size ?? '');
		if (!parsed) return bundle;
		const unitPrice = price / parsed.amount;
		const formatted =
			unitPrice < 0.1
				? unitPrice.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 3, maximumFractionDigits: 3 })
				: money(unitPrice);
		return `${formatted}/${parsed.unit} (${bundle})`;
	}

	function parsePackageAmount(size: string): { amount: number; unit: string } | null {
		const m = size
			.trim()
			.match(
				/^(\d+(?:\.\d+)?)\s*(fl\s*oz|fluid\s*ounces?|oz|ounces?|lb|lbs|pounds?|g|grams?|kg|kilograms?|ml|l|ct|count|ea|each)\b/i
			);
		if (!m) return null;
		const amount = Number(m[1]);
		if (!Number.isFinite(amount) || amount <= 0) return null;
		let unit = m[2].toLowerCase().replace(/\s+/g, '');
		if (unit.startsWith('fluid') || unit === 'floz') unit = 'fl oz';
		else if (unit.startsWith('ounce')) unit = 'oz';
		else if (unit.startsWith('pound') || unit === 'lbs') unit = 'lb';
		else if (unit.startsWith('gram')) unit = 'g';
		else if (unit.startsWith('kilogram')) unit = 'kg';
		else if (unit === 'count' || unit === 'ea' || unit === 'each') unit = 'ea';
		else if (unit === 'ct') unit = 'ea';
		return { amount, unit };
	}

	const activeLine = $derived(
		pickerLineIndex !== null && estimate ? estimate.lines[pickerLineIndex] : null
	);
</script>

<section class="estimate">
	<div class="estimate__head">
		<h2>{title}</h2>
		{#if estimate}
			<p class="estimate__total">{money(estimate.total)}</p>
		{/if}
	</div>

	{#if loadingStore}
		<p class="muted">Loading store…</p>
	{:else}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button
			type="button"
			class="btn btn--primary"
			onclick={runEstimate}
			disabled={estimating || usableLines.length === 0}
		>
			{estimating ? 'Estimating…' : estimate ? 'Refresh estimate' : 'Estimate cost'}
		</button>

		{#if estimate}
			<button type="button" class="details-toggle" onclick={() => (showDetails = !showDetails)}>
				{showDetails ? 'Hide line details' : 'Show line details'}
			</button>

			{#if showDetails}
				<ul class="lines">
					{#each estimate.lines as line, index}
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
										· {unitAndBundle(line.productPrice, line.productSize)}
									{/if}
									{#if pricing === 'packages' && line.packagesNeeded && line.packagesNeeded > 1}
										· buy {line.packagesNeeded}
									{/if}
								</p>
							{:else if line.reason}
								<p class="line__meta">{line.reason}</p>
							{/if}
							<button
								type="button"
								class="change"
								onclick={() => openPicker(index)}
								disabled={pickerLoading && pickerLineIndex === index}
							>
								Change product
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	{/if}
</section>

<dialog
	class="picker"
	bind:this={dialogEl}
	aria-labelledby="picker-title"
	onclose={closePicker}
	onclick={(event) => {
		if (event.target === dialogEl) closePicker();
	}}
>
	<div class="picker__panel">
		<h2 id="picker-title">Choose a product</h2>
		{#if activeLine}
			<p class="picker__lede">
				For <strong>{activeLine.input}</strong>
			</p>
		{/if}

		<form class="picker__search" onsubmit={submitPickerSearch}>
			<label>
				<span>Search term</span>
				<input
					bind:value={pickerSearchTerm}
					type="search"
					placeholder="e.g. vanilla extract"
					autocomplete="off"
					disabled={pickerLoading || !activeLine}
				/>
			</label>
			<button type="submit" class="btn btn--primary" disabled={pickerLoading || !activeLine}>
				{pickerLoading ? 'Searching…' : 'Search'}
			</button>
		</form>

		{#if pickerError}
			<p class="error" role="alert">{pickerError}</p>
		{/if}

		{#if pickerLoading && pickerOptions.length === 0}
			<p class="muted">Searching Kroger…</p>
		{:else if pickerOptions.length > 0}
			<ul class="picker__list">
				{#each pickerOptions as option (option.productId + option.size)}
					<li>
						<button
							type="button"
							class="option"
							class:option--current={activeLine?.productId === option.productId}
							onclick={() => applyOption(option)}
						>
							<span class="option__main">
								<span class="option__name">{option.description}</span>
								<span class="option__meta">
									{#if option.brand}{option.brand} · {/if}
									{option.size} · {unitAndBundle(option.price, option.size)}
									{#if pricing === 'packages' && option.packagesNeeded && option.packagesNeeded > 1}
										· buy {option.packagesNeeded}
									{/if}
								</span>
							</span>
							<span class="option__cost">{money(option.estimate)}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}

		<div class="picker__actions">
			<button type="button" class="btn btn--ghost" onclick={closePicker}>Cancel</button>
		</div>
	</div>
</dialog>

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
		opacity: 0.85;
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
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.line__meta {
		margin: 0.25rem 0 0;
		font-size: 0.8rem;
		color: var(--ink-soft);
		line-height: 1.35;
	}

	.change {
		appearance: none;
		border: none;
		background: none;
		padding: 0;
		margin-top: 0.35rem;
		font: inherit;
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--leaf-deep);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.change:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.picker {
		position: fixed;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0;
		border: none;
		border-radius: 1.1rem;
		background: transparent;
		max-width: min(28rem, calc(100vw - 2rem));
		max-height: min(36rem, calc(100vh - 2rem));
	}

	.picker::backdrop {
		background: rgba(19, 32, 24, 0.45);
		backdrop-filter: blur(4px);
	}

	.picker__panel {
		padding: 1.25rem 1.3rem 1.15rem;
		background: #f7fbf8;
		border: 1px solid rgba(19, 32, 24, 0.08);
		border-radius: 1.1rem;
		box-shadow: 0 18px 40px rgba(19, 32, 24, 0.18);
		display: grid;
		gap: 0.75rem;
		max-height: min(34rem, calc(100vh - 3rem));
	}

	.picker__panel h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.3rem;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.picker__lede {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.4;
	}

	.picker__search {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		align-items: end;
	}

	.picker__search label {
		display: grid;
		gap: 0.3rem;
		flex: 1;
		min-width: 12rem;
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--ink-soft);
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.picker__search input {
		font: inherit;
		font-size: 1rem;
		font-weight: 500;
		text-transform: none;
		letter-spacing: 0;
		color: var(--ink);
		border: 1.5px solid var(--line);
		border-radius: 0.55rem;
		padding: 0.55rem 0.7rem;
		background: rgba(255, 255, 255, 0.9);
		width: 100%;
	}

	.picker__search input:focus {
		outline: none;
		border-color: rgba(27, 107, 69, 0.4);
		background: #fff;
	}

	.picker__search .btn {
		justify-self: stretch;
	}

	.picker__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: 0.4rem;
		overflow: auto;
		max-height: min(22rem, 50vh);
	}

	.option {
		appearance: none;
		width: 100%;
		border: 1.5px solid rgba(19, 32, 24, 0.1);
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.85);
		padding: 0.7rem 0.75rem;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		text-align: left;
		cursor: pointer;
		font: inherit;
		color: inherit;
	}

	.option:hover {
		border-color: rgba(27, 107, 69, 0.35);
		background: #fff;
	}

	.option--current {
		border-color: rgba(27, 107, 69, 0.45);
		background: rgba(27, 107, 69, 0.08);
	}

	.option__main {
		min-width: 0;
		display: grid;
		gap: 0.15rem;
	}

	.option__name {
		font-weight: 600;
		font-size: 0.92rem;
		line-height: 1.3;
	}

	.option__meta {
		font-size: 0.78rem;
		color: var(--ink-soft);
		line-height: 1.35;
	}

	.option__cost {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		color: var(--leaf-deep);
	}

	.picker__actions {
		display: flex;
		justify-content: flex-end;
	}
</style>
