<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import IconPenEditor from '$lib/components/IconPenEditor.svelte';
	import PantryRecipeIdeas from '$lib/components/PantryRecipeIdeas.svelte';
	import { displayEmoji, FOOD_EMOJI, isCustomIcon } from '$lib/emoji';
	import {
		createPantryItem,
		deletePantryItem,
		getSharedPantry,
		listPantry,
		togglePantryStock,
		updatePantryItem
	} from '$lib/pantry-api';
	import { getOrCreateSharedPantry } from '$lib/friends-api';
	import { listRecipes } from '$lib/recipes-api';
	import { pageTitle } from '$lib/site';
	import type { PantryItem, PublicUser, Recipe } from '$lib/types';

	type PantryUnit = 'percent' | 'count';

	/** Count at or below this (but still > 0) is “running low”. */
	const LOW_COUNT = 2;
	/** Percent at or below this (but still > 0) is “really low”. */
	const LOW_PERCENT = 25;

	const sharedId = $derived(page.url.searchParams.get('shared')?.trim() || '');
	const friendId = $derived(page.url.searchParams.get('friend')?.trim() || '');

	let items = $state<PantryItem[]>([]);
	let recipes = $state<Recipe[]>([]);
	let recipesReady = $state(false);
	let sharedWith = $state<PublicUser | null>(null);
	let activeSharedId = $state('');
	let ready = $state(false);
	let error = $state('');
	let savingId = $state('');
	let busy = $state(false);

	let newName = $state('');
	let newEmoji = $state('🥚');
	let newNotes = $state('');
	let newUnit = $state<PantryUnit>('percent');
	let newAmount = $state(100);

	let iconEditItem = $state<PantryItem | null>(null);
	let iconDialogEl = $state<HTMLDialogElement | null>(null);
	let drawOpen = $state(false);
	let drawingForItem = $state<PantryItem | null>(null);

	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const sharedLabel = $derived(
		sharedWith ? sharedWith.nickname?.trim() || sharedWith.name?.trim() || sharedWith.email : ''
	);
	const heading = $derived(sharedLabel ? `Pantry with ${sharedLabel}` : 'Pantry');

	function isLowStock(item: PantryItem): boolean {
		if (item.percent <= 0 || !item.inStock) return false;
		if (item.unit === 'count') return item.percent <= LOW_COUNT;
		return item.percent <= LOW_PERCENT;
	}

	function lowStockLabel(item: PantryItem): string {
		if (item.unit === 'count') {
			return item.percent === 1 ? '1 left' : `${item.percent} left`;
		}
		return `${item.percent}% left`;
	}

	const lowItems = $derived(items.filter(isLowStock));

	async function loadPantry(silent = false) {
		try {
			if (sharedId) {
				const pantry = await getSharedPantry(sharedId);
				items = pantry.items;
				sharedWith = pantry.sharedWith ?? null;
				activeSharedId = pantry.id;
			} else if (friendId) {
				const pantry = await getOrCreateSharedPantry(friendId);
				items = pantry.items;
				sharedWith = pantry.sharedWith ?? null;
				activeSharedId = pantry.id;
				if (typeof history !== 'undefined') {
					const next = `${base}/pantry?shared=${encodeURIComponent(pantry.id)}`;
					history.replaceState(history.state, '', next);
				}
			} else {
				items = await listPantry();
				sharedWith = null;
				activeSharedId = '';
			}
		} catch (e) {
			if (!silent) {
				error = e instanceof Error ? e.message : 'Failed to load pantry';
			}
		}
	}

	onMount(async () => {
		await loadPantry();
		ready = true;
		void listRecipes()
			.then((loaded) => {
				recipes = loaded;
			})
			.catch(() => {
				recipes = [];
			})
			.finally(() => {
				recipesReady = true;
			});
		if (sharedId || friendId || activeSharedId) {
			pollTimer = setInterval(() => {
				if (!busy && !savingId) {
					void loadPantry(true);
				}
			}, 8000);
		}
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
	});

	function clampAmount(unit: PantryUnit, value: number): number {
		if (Number.isNaN(value)) return 0;
		const rounded = Math.round(value);
		if (unit === 'count') return Math.min(999, Math.max(0, rounded));
		return Math.min(100, Math.max(0, rounded));
	}

	function applyAmount(item: PantryItem, raw: number) {
		const amount = clampAmount(item.unit, raw);
		item.percent = amount;
		item.inStock = amount > 0;
	}

	function setUnit(item: PantryItem, unit: PantryUnit) {
		item.unit = unit;
		if (unit === 'count' && item.percent > 24) {
			item.percent = 12;
		}
		if (unit === 'percent' && item.percent > 100) {
			item.percent = 100;
		}
		item.inStock = item.percent > 0;
	}

	async function saveItem(item: PantryItem) {
		if (!item.name.trim()) {
			error = 'Every pantry item needs a name.';
			return;
		}
		applyAmount(item, item.percent);
		savingId = item.id;
		error = '';
		try {
			const updated = await updatePantryItem(item.id, {
				name: item.name.trim(),
				emoji: item.emoji.trim(),
				notes: item.notes.trim(),
				inStock: item.inStock,
				percent: item.percent,
				unit: item.unit
			});
			items = items.map((entry) => (entry.id === item.id ? updated : entry));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to save item';
		} finally {
			savingId = '';
		}
	}

	async function toggleStock(item: PantryItem) {
		error = '';
		try {
			const updated = await togglePantryStock(item.id);
			items = items.map((entry) => (entry.id === item.id ? updated : entry));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update stock';
		}
	}

	async function removeItem(item: PantryItem) {
		if (!confirm(`Remove ${displayEmoji(item.emoji, '📦')} ${item.name}?`)) return;
		error = '';
		try {
			await deletePantryItem(item.id);
			items = items.filter((entry) => entry.id !== item.id);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to delete item';
		}
	}

	function onNewUnitChange(unit: PantryUnit) {
		newUnit = unit;
		newAmount = unit === 'count' ? 12 : 100;
	}

	async function addItem(event: Event) {
		event.preventDefault();
		if (!newName.trim()) {
			error = 'Give the new item a name.';
			return;
		}
		const amount = clampAmount(newUnit, newAmount);
		error = '';
		try {
			const created = await createPantryItem({
				name: newName.trim(),
				emoji: newEmoji.trim() || '📦',
				notes: newNotes.trim(),
				inStock: amount > 0,
				percent: amount,
				unit: newUnit,
				...(activeSharedId || sharedId
					? { sharedPantryId: activeSharedId || sharedId }
					: {})
			});
			items = [...items, created];
			newName = '';
			newNotes = '';
			newEmoji = '🥚';
			newUnit = 'percent';
			newAmount = 100;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add item';
		}
	}

	function openIconPicker(item: PantryItem) {
		iconEditItem = item;
		iconDialogEl?.showModal();
	}

	function closeIconPicker() {
		iconDialogEl?.close();
		iconEditItem = null;
	}

	function setItemIcon(emoji: string) {
		if (!iconEditItem) return;
		iconEditItem.emoji = emoji;
		saveItem(iconEditItem);
		closeIconPicker();
	}

	function startDrawingIcon() {
		drawingForItem = iconEditItem;
		closeIconPicker();
		drawOpen = true;
	}

	function onDrawnIcon(dataUrl: string) {
		const item = drawingForItem;
		drawingForItem = null;
		if (!item) return;
		item.emoji = dataUrl;
		saveItem(item);
	}
</script>

<svelte:head>
	<title>{pageTitle(heading)}</title>
</svelte:head>

<main class="page">
	<header class="intro">
		{#if sharedId || friendId || activeSharedId}
			<p class="eyebrow">
				<a href="{base}/friends">Friends</a>
				<span class="eyebrow__sep" aria-hidden="true">›</span>
				<span>Shared pantry</span>
			</p>
		{/if}
		<h1><span class="ico" aria-hidden="true">🏠</span> {heading}</h1>
		{#if sharedWith && sharedLabel}
			<p class="shared-banner" role="status">
				Shared with <strong>{sharedLabel}</strong> — updates appear for both of you.
			</p>
		{:else}
			<p class="lede">Track staples by how full they are, or by count for eggs, onions, lemons, and more.</p>
		{/if}
	</header>

	{#if !ready}
		<p class="muted">Loading…</p>
	{:else}
		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		{#if lowItems.length > 0}
			<div class="low-banner" role="status">
				<p class="low-banner__title">Running low</p>
				<ul class="low-banner__list">
					{#each lowItems as item (item.id)}
						<li>
							<span class="low-banner__emoji" aria-hidden="true"
								>{displayEmoji(item.emoji, '📦')}</span
							>
							<span class="low-banner__name">{item.name}</span>
							<span class="low-banner__amt">{lowStockLabel(item)}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}

		<PantryRecipeIdeas items={items} recipes={recipes} loading={!recipesReady} />

		<ul class="list">
			{#each items as item, i (item.id)}
				<li
					class="item"
					class:out={!item.inStock}
					class:item--low={isLowStock(item)}
					style={`--i: ${i}`}
				>
					{#if isLowStock(item)}
						<p class="item__low" role="status">
							Low — {lowStockLabel(item)}
						</p>
					{/if}
					<div class="item__head">
						<div class="item__lead">
							<button
								type="button"
								class="emoji"
								aria-label="Change icon for {item.name}"
								onclick={() => openIconPicker(item)}
							>
								{#if isCustomIcon(item.emoji)}
									<img class="emoji__img" src={item.emoji} alt="" width="36" height="36" />
								{:else}
									{displayEmoji(item.emoji, '📦')}
								{/if}
							</button>
						</div>
						<div class="item__identity">
							<input
								class="name"
								bind:value={item.name}
								aria-label="Name"
								onchange={() => saveItem(item)}
							/>
							<input
								class="notes"
								bind:value={item.notes}
								placeholder="Notes"
								aria-label="Notes for {item.name}"
								onchange={() => saveItem(item)}
							/>
						</div>
					</div>

					<button
						type="button"
						class="status"
						class:on={item.inStock}
						onclick={() => toggleStock(item)}
					>
						<span class="status__dot" aria-hidden="true"></span>
						{item.inStock ? 'In stock' : 'Out'}
					</button>

					<div class="fill">
						<div class="fill__meta">
							<label class="fill__label" for="amt-{item.id}">
								{item.unit === 'count' ? 'Count' : 'Level'}
							</label>
							<select
								class="unit unit--quiet"
								value={item.unit}
								aria-label="Unit for {item.name}"
								onchange={(event) => {
									const unit = (event.currentTarget as HTMLSelectElement).value as PantryUnit;
									setUnit(item, unit);
									saveItem(item);
								}}
							>
								<option value="percent">%</option>
								<option value="count">count</option>
							</select>
						</div>

						{#if item.unit === 'count'}
							<div class="count-row">
								<button
									type="button"
									class="stepper__btn"
									aria-label="Decrease {item.name}"
									onclick={() => {
										applyAmount(item, item.percent - 1);
										saveItem(item);
									}}
								>
									−
								</button>
								<input
									id="amt-{item.id}"
									class="count-input"
									type="number"
									min="0"
									max="999"
									step="1"
									value={item.percent}
									oninput={(event) => {
										const value = Number((event.currentTarget as HTMLInputElement).value);
										applyAmount(item, value);
									}}
									onchange={() => saveItem(item)}
									aria-label="Count for {item.name}"
								/>
								<button
									type="button"
									class="stepper__btn"
									aria-label="Increase {item.name}"
									onclick={() => {
										applyAmount(item, item.percent + 1);
										saveItem(item);
									}}
								>
									+
								</button>
								<span class="count-suffix">{item.name.toLowerCase()}</span>
							</div>
						{:else}
							<div class="fill__value">
								<input
									id="amt-{item.id}"
									class="percent"
									type="number"
									min="0"
									max="100"
									step="1"
									value={item.percent}
									oninput={(event) => {
										const value = Number((event.currentTarget as HTMLInputElement).value);
										applyAmount(item, value);
									}}
									onchange={() => saveItem(item)}
									aria-label="Percent remaining for {item.name}"
								/>
								<span aria-hidden="true">%</span>
							</div>
							<div class="fill__track">
								<input
									class="slider"
									type="range"
									min="0"
									max="100"
									step="1"
									value={item.percent}
									style={`--pct: ${item.percent}%`}
									oninput={(event) => {
										const value = Number((event.currentTarget as HTMLInputElement).value);
										applyAmount(item, value);
									}}
									onchange={() => saveItem(item)}
									aria-label="Percent slider for {item.name}"
								/>
							</div>
						{/if}
					</div>

					<div class="item__foot">
						<span class="saving" class:visible={savingId === item.id}>Saving…</span>
						<button type="button" class="remove" onclick={() => removeItem(item)}>
							Remove
						</button>
					</div>
				</li>
			{/each}
		</ul>

		<section class="add">
			<h2>Add item</h2>
			<form class="add__form" onsubmit={addItem}>
				<EmojiPicker bind:value={newEmoji} label="Icon" fallback="🥚" />
				<div class="add__row">
					<label class="grow">
						<span>Name</span>
						<input bind:value={newName} type="text" placeholder="Eggs" required />
					</label>
					<label class="pct-field">
						<span class="amount-label">
							{newUnit === 'count' ? 'How many' : 'Level'}
							<select
								class="unit unit--quiet"
								value={newUnit}
								aria-label="Unit"
								onchange={(event) =>
									onNewUnitChange(
										(event.currentTarget as HTMLSelectElement).value as PantryUnit
									)}
							>
								<option value="percent">%</option>
								<option value="count">count</option>
							</select>
						</span>
						<input
							bind:value={newAmount}
							type="number"
							min="0"
							max={newUnit === 'count' ? 999 : 100}
							step="1"
						/>
					</label>
				</div>
				<label>
					<span>Notes</span>
					<input bind:value={newNotes} type="text" placeholder="Brand, size…" />
				</label>
				<button type="submit" class="btn">Add to pantry</button>
			</form>
		</section>
	{/if}
</main>

<dialog
	class="icon-dialog"
	bind:this={iconDialogEl}
	aria-labelledby="icon-dialog-title"
	onclose={() => {
		iconEditItem = null;
	}}
	onclick={(event) => {
		if (event.target === iconDialogEl) closeIconPicker();
	}}
>
	{#if iconEditItem}
		<div class="icon-dialog__panel">
			<h2 id="icon-dialog-title">Choose an icon</h2>
			<p class="icon-dialog__for">{iconEditItem.name}</p>
			<div class="icon-dialog__preview" aria-hidden="true">
				{#if isCustomIcon(iconEditItem.emoji)}
					<img src={iconEditItem.emoji} alt="" width="48" height="48" />
				{:else}
					{displayEmoji(iconEditItem.emoji, '📦')}
				{/if}
			</div>
			<div class="icon-dialog__picks" role="listbox" aria-label="Emoji suggestions">
				{#each FOOD_EMOJI as emoji}
					<button
						type="button"
						class="icon-pick"
						class:active={!isCustomIcon(iconEditItem.emoji) && iconEditItem.emoji === emoji}
						onclick={() => setItemIcon(emoji)}
					>
						{emoji}
					</button>
				{/each}
			</div>
			<div class="icon-dialog__actions">
				<button type="button" class="btn btn--ghost" onclick={closeIconPicker}>Cancel</button>
				<button type="button" class="btn" onclick={startDrawingIcon}>Draw your own</button>
			</div>
		</div>
	{/if}
</dialog>

<IconPenEditor bind:open={drawOpen} onsave={onDrawnIcon} oncancel={() => (drawingForItem = null)} />

<style>
	.page {
		padding: clamp(2rem, 6vh, 3.5rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
	}

	.intro {
		margin-bottom: 2rem;
	}

	.eyebrow {
		font-size: 0.92rem;
		margin: 0 0 0.85rem;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
		color: var(--ink-soft);
	}

	.eyebrow a {
		color: var(--leaf);
		font-weight: 600;
		text-decoration: none;
	}

	.eyebrow__sep {
		opacity: 0.55;
	}

	.shared-banner {
		margin: 0 0 0.25rem;
		padding: 0.7rem 0.9rem;
		border-radius: 0.75rem;
		background: rgba(27, 107, 69, 0.1);
		border: 1.5px solid rgba(27, 107, 69, 0.18);
		color: var(--ink-soft);
		font-size: 0.95rem;
		max-width: 40rem;
	}

	.shared-banner strong {
		color: var(--ink);
		font-weight: 650;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2.1rem, 5vw, 3rem);
		letter-spacing: -0.05em;
		line-height: 1.05;
		margin-bottom: 0.55rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}

	.ico {
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.lede {
		color: var(--ink-soft);
		font-size: 1.02rem;
		max-width: 36ch;
		line-height: 1.45;
	}

	.muted {
		color: var(--ink-soft);
	}

	.error {
		color: #8a2f2f;
		margin-bottom: 1rem;
		font-size: 0.95rem;
	}

	.list {
		list-style: none;
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.75rem;
		margin-bottom: 2.75rem;
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
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
	}

	.item {
		background: rgba(255, 255, 255, 0.55);
		border: 1px solid rgba(19, 32, 24, 0.07);
		border-radius: 1.15rem;
		padding: 1rem 1.1rem 0.85rem;
		display: grid;
		gap: 0.7rem;
		min-width: 0;
		container-type: inline-size;
		backdrop-filter: blur(10px);
		transition:
			opacity 0.3s var(--ease),
			transform 0.35s var(--ease),
			background 0.3s var(--ease),
			border-color 0.3s var(--ease);
		animation: rise 0.55s var(--ease) both;
		animation-delay: calc(var(--i, 0) * 40ms);
	}

	.item:hover {
		background: rgba(255, 255, 255, 0.78);
		border-color: rgba(27, 107, 69, 0.18);
	}

	.item.out {
		opacity: 0.72;
	}

	.item.out:hover {
		opacity: 0.9;
	}

	.item--low {
		border-color: rgba(180, 100, 30, 0.35);
		background: rgba(255, 244, 230, 0.72);
		box-shadow: inset 3px 0 0 rgba(196, 110, 28, 0.85);
	}

	.item--low:hover {
		background: rgba(255, 248, 238, 0.9);
		border-color: rgba(180, 100, 30, 0.45);
	}

	.item__low {
		margin: -0.15rem 0 0;
		padding: 0.35rem 0.55rem;
		border-radius: 0.5rem;
		background: rgba(196, 110, 28, 0.14);
		color: #8a4b12;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	.low-banner {
		margin-bottom: 1.25rem;
		padding: 0.9rem 1rem 1rem;
		border-radius: 0.9rem;
		border: 1.5px solid rgba(180, 100, 30, 0.28);
		background: rgba(255, 244, 230, 0.85);
	}

	.low-banner__title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
		color: #8a4b12;
		margin-bottom: 0.55rem;
	}

	.low-banner__list {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.55rem;
	}

	.low-banner__list li {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.6rem;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.7);
		border: 1px solid rgba(180, 100, 30, 0.2);
		font-size: 0.88rem;
	}

	.low-banner__emoji {
		font-size: 1rem;
		line-height: 1;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.low-banner__name {
		font-weight: 650;
		color: var(--ink);
	}

	.low-banner__amt {
		font-weight: 700;
		color: #8a4b12;
		font-variant-numeric: tabular-nums;
	}

	.item__head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 0.7rem;
		align-items: start;
	}

	.item__lead {
		width: 2.75rem;
	}

	.emoji {
		width: 2.75rem;
		height: 2.75rem;
		display: grid;
		place-items: center;
		text-align: center;
		font-size: 1.35rem;
		font: inherit;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
		color: var(--ink);
		background: rgba(27, 107, 69, 0.08);
		border: none;
		border-radius: 0.85rem;
		padding: 0;
		cursor: pointer;
		overflow: hidden;
		transition: background 0.25s var(--ease);
	}

	.emoji:hover {
		background: rgba(27, 107, 69, 0.14);
	}

	.emoji:focus {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 2px;
	}

	.emoji__img {
		width: 1.7rem;
		height: 1.7rem;
		object-fit: contain;
		display: block;
	}

	.item__identity {
		min-width: 0;
		display: grid;
		gap: 0.1rem;
	}

	.name,
	.notes {
		width: 100%;
		font: inherit;
		color: var(--ink);
		background: transparent;
		border: none;
		border-radius: 0.35rem;
		padding: 0.1rem 0.2rem;
		margin: 0 -0.2rem;
	}

	.name {
		font-weight: 600;
		font-size: 1.05rem;
		letter-spacing: -0.02em;
	}

	.notes {
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.notes::placeholder {
		color: rgba(61, 82, 71, 0.45);
	}

	.name:focus,
	.notes:focus {
		outline: none;
		background: rgba(27, 107, 69, 0.06);
	}

	.status {
		appearance: none;
		justify-self: start;
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		border: none;
		border-radius: 0.5rem;
		padding: 0.42rem 0.5rem;
		margin-top: 0.25rem;
		margin-bottom: -0.1rem;
		font: inherit;
		font-size: 0.68rem;
		font-weight: 600;
		letter-spacing: 0.01em;
		cursor: pointer;
		background: rgba(138, 47, 47, 0.1);
		color: #8a2f2f;
		white-space: nowrap;
		transition:
			background 0.25s var(--ease),
			color 0.25s var(--ease),
			transform 0.2s var(--ease);
	}

	.status:hover {
		transform: translateY(-1px);
	}

	.status:active {
		transform: translateY(0);
	}

	.status.on {
		background: rgba(27, 107, 69, 0.12);
		color: var(--leaf-deep);
	}

	.status__dot {
		width: 0.45rem;
		height: 0.45rem;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.85;
		box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
	}

	.fill {
		display: grid;
		gap: 0.45rem;
	}

	.fill__meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.fill__label {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-soft);
		opacity: 0.85;
	}

	.unit {
		font: inherit;
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.02em;
		color: var(--ink-soft);
		background: transparent;
		border: none;
		border-radius: 0.3rem;
		padding: 0.1rem 0.15rem;
		cursor: pointer;
		opacity: 0.75;
	}

	.unit:hover,
	.unit:focus {
		opacity: 1;
		outline: none;
		background: rgba(19, 32, 24, 0.05);
	}

	.unit--quiet {
		appearance: none;
		-webkit-appearance: none;
		background-image: none;
		text-align: right;
	}

	.count-row {
		display: flex;
		align-items: center;
		gap: 0.45rem;
	}

	.stepper__btn {
		appearance: none;
		border: none;
		width: 1.85rem;
		height: 1.85rem;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font: inherit;
		font-size: 1.1rem;
		font-weight: 700;
		line-height: 1;
		cursor: pointer;
		color: var(--leaf-deep);
		background: rgba(27, 107, 69, 0.12);
		padding: 0;
	}

	.stepper__btn:hover {
		background: rgba(27, 107, 69, 0.2);
	}

	.count-input {
		width: 3.5rem;
		font: inherit;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		font-size: 1.15rem;
		color: var(--leaf-deep);
		text-align: center;
		background: rgba(255, 255, 255, 0.8);
		border: 1px solid rgba(19, 32, 24, 0.1);
		border-radius: 0.55rem;
		padding: 0.35rem 0.25rem;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.count-input::-webkit-outer-spin-button,
	.count-input::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.count-suffix {
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink-soft);
		text-transform: lowercase;
	}

	.fill__value {
		display: inline-flex;
		align-items: baseline;
		gap: 0.15rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		font-size: 0.95rem;
		color: var(--leaf-deep);
		justify-self: end;
	}

	.percent {
		width: 3.1rem;
		font: inherit;
		font-weight: inherit;
		font-variant-numeric: inherit;
		color: inherit;
		background: transparent;
		border: none;
		border-radius: 0.3rem;
		text-align: right;
		padding: 0.05rem 0.15rem;
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.percent::-webkit-outer-spin-button,
	.percent::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}

	.percent:focus {
		outline: none;
		background: rgba(27, 107, 69, 0.08);
	}

	.fill__track {
		position: relative;
	}

	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 0.55rem;
		border-radius: 999px;
		background: linear-gradient(
			90deg,
			var(--leaf) 0%,
			var(--leaf-bright) var(--pct, 0%),
			rgba(19, 32, 24, 0.08) var(--pct, 0%)
		);
		outline: none;
		cursor: pointer;
	}

	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
		background: #fff;
		border: 2px solid var(--leaf);
		box-shadow: 0 1px 4px rgba(19, 32, 24, 0.18);
		transition: transform 0.2s var(--ease);
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.08);
	}

	.slider::-moz-range-thumb {
		width: 1.15rem;
		height: 1.15rem;
		border-radius: 50%;
		background: #fff;
		border: 2px solid var(--leaf);
		box-shadow: 0 1px 4px rgba(19, 32, 24, 0.18);
	}

	.slider::-moz-range-track {
		height: 0.55rem;
		border-radius: 999px;
		background: transparent;
	}

	.item__foot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 1.25rem;
	}

	.saving {
		font-size: 0.72rem;
		font-weight: 600;
		color: var(--leaf);
		opacity: 0;
		transition: opacity 0.25s var(--ease);
	}

	.saving.visible {
		opacity: 0.85;
	}

	.remove {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.78rem;
		font-weight: 500;
		color: var(--ink-soft);
		cursor: pointer;
		padding: 0.2rem 0;
		opacity: 0.65;
		transition:
			opacity 0.2s var(--ease),
			color 0.2s var(--ease);
	}

	.remove:hover {
		opacity: 1;
		color: #8a2f2f;
	}

	.add {
		border-top: 1px solid var(--line);
		padding-top: 1.75rem;
		max-width: 36rem;
	}

	.add h2 {
		font-family: var(--font-display);
		font-weight: 700;
		font-size: 1.2rem;
		letter-spacing: -0.03em;
		margin-bottom: 1rem;
	}

	.add__form {
		display: grid;
		gap: 0.85rem;
	}

	.add__row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 6.5rem;
		gap: 0.65rem;
		align-items: end;
	}

	.grow {
		min-width: 0;
	}

	.pct-field {
		min-width: 0;
	}

	.amount-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.35rem;
	}

	.pct-field input {
		width: 100%;
		text-align: center;
		font-variant-numeric: tabular-nums;
		box-sizing: border-box;
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

	label input,
	label select {
		font: inherit;
		padding: 0.7rem 0.8rem;
		border-radius: 0.7rem;
		border: 1px solid rgba(19, 32, 24, 0.1);
		background: rgba(255, 255, 255, 0.7);
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', var(--font-body), sans-serif;
		transition:
			border-color 0.2s var(--ease),
			background 0.2s var(--ease);
	}

	label input:focus,
	label select:focus {
		outline: none;
		border-color: rgba(27, 107, 69, 0.4);
		background: #fff;
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
		justify-self: start;
		transition:
			background 0.25s var(--ease),
			transform 0.2s var(--ease);
	}

	.btn:hover {
		background: var(--leaf-deep);
		transform: translateY(-1px);
	}

	.btn:active {
		transform: translateY(0);
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.btn--ghost:hover {
		background: rgba(255, 255, 255, 0.7);
		color: var(--ink);
	}

	.icon-dialog {
		position: fixed;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0;
		border: none;
		border-radius: 1.1rem;
		background: transparent;
		max-width: min(26rem, calc(100vw - 2rem));
	}

	.icon-dialog::backdrop {
		background: rgba(19, 32, 24, 0.45);
		backdrop-filter: blur(4px);
	}

	.icon-dialog__panel {
		padding: 1.25rem 1.3rem 1.15rem;
		background: #f7fbf8;
		border: 1px solid rgba(19, 32, 24, 0.08);
		border-radius: 1.1rem;
		box-shadow: 0 18px 40px rgba(19, 32, 24, 0.18);
		display: grid;
		gap: 0.75rem;
	}

	.icon-dialog__panel h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.25rem;
		letter-spacing: -0.03em;
		margin: 0;
	}

	.icon-dialog__for {
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
	}

	.icon-dialog__preview {
		width: 3.25rem;
		height: 3.25rem;
		border-radius: 0.85rem;
		background: rgba(27, 107, 69, 0.08);
		display: grid;
		place-items: center;
		font-size: 1.6rem;
		overflow: hidden;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.icon-dialog__preview img {
		width: 2.1rem;
		height: 2.1rem;
		object-fit: contain;
	}

	.icon-dialog__picks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
		max-height: 11rem;
		overflow: auto;
	}

	.icon-pick {
		appearance: none;
		border: 1.5px solid transparent;
		background: rgba(255, 255, 255, 0.7);
		border-radius: 0.45rem;
		width: 2.15rem;
		height: 2.15rem;
		font-size: 1.15rem;
		line-height: 1;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.icon-pick:hover,
	.icon-pick.active {
		border-color: rgba(27, 107, 69, 0.35);
		background: var(--mist);
	}

	.icon-dialog__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.25rem;
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

	@media (max-width: 520px) {
		.add__row {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page,
		.item {
			animation: none;
		}

		.item,
		.status,
		.btn,
		.slider::-webkit-slider-thumb {
			transition: none;
		}
	}
</style>
