<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import {
		getOrCreateSharedList,
		listFriends
	} from '$lib/friends-api';
	import { mergeIngredientLists } from '$lib/ingredients';
	import { friendDisplayLabel } from '$lib/pantry-nav-pref.svelte';
	import {
		encodeShoppingList,
		mergeRecipeCounts,
		parseShoppingListImport
	} from '$lib/shopping-list-io';
	import {
		addShoppingListItem,
		deleteShoppingList,
		getShoppingList,
		removeShoppingListItem,
		toggleShoppingListItem,
		updateShoppingList,
		updateShoppingListTitle
	} from '$lib/shopping-lists-api';
	import CostEstimatePanel from '$lib/components/CostEstimatePanel.svelte';
	import ScanListPhoto from '$lib/components/ScanListPhoto.svelte';
	import { displayEmoji } from '$lib/emoji';
	import { listRecipes } from '$lib/recipes-api';
	import { pageTitle } from '$lib/site';
	import type { ImportedShoppingList, PublicUser, Recipe, ShoppingList } from '$lib/types';

	const id = $derived(page.params.id ?? '');

	let list = $state<ShoppingList | null>(null);
	let recipes = $state<Recipe[]>([]);
	let ready = $state(false);
	let error = $state('');
	let statusMsg = $state('');
	let newItem = $state('');
	let busy = $state(false);
	let confirmOpen = $state(false);
	let confirmMode = $state<'list' | 'item' | 'clear'>('list');
	let pendingItem = $state<{ id: string; text: string } | null>(null);
	let dialogEl = $state<HTMLDialogElement | null>(null);

	let shareOpen = $state(false);
	let shareDialogEl = $state<HTMLDialogElement | null>(null);
	let friends = $state<PublicUser[]>([]);
	let friendsLoading = $state(false);
	let selectedFriendId = $state('');

	let exportOpen = $state(false);
	let exportDialogEl = $state<HTMLDialogElement | null>(null);
	let exportCode = $state('');
	let exportTextEl = $state<HTMLTextAreaElement | null>(null);
	let copyMsg = $state('');

	let importOpen = $state(false);
	let importDialogEl = $state<HTMLDialogElement | null>(null);
	let importCode = $state('');
	let importError = $state('');

	let moreOpen = $state(false);
	let editingTitle = $state(false);
	let titleDraft = $state('');
	let titleInputEl = $state<HTMLInputElement | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const anyDialogOpen = $derived(confirmOpen || shareOpen || exportOpen || importOpen);
	const canClear = $derived(
		Boolean(
			list &&
				(list.items.length > 0 || Object.keys(list.recipeCounts ?? {}).length > 0)
		)
	);

	const listHeading = $derived(list?.title || '');

	function closeMore() {
		moreOpen = false;
	}

	function toggleMore(e: MouseEvent) {
		e.stopPropagation();
		moreOpen = !moreOpen;
	}

	function onDocClick(e: MouseEvent) {
		if (!moreOpen) return;
		const target = e.target as HTMLElement | null;
		if (target?.closest('[data-list-more]')) return;
		closeMore();
	}

	function startEditTitle() {
		if (!list || busy) return;
		editingTitle = true;
		titleDraft = list.title;
		queueMicrotask(() => {
			titleInputEl?.focus();
			titleInputEl?.select();
		});
	}

	function cancelEditTitle() {
		editingTitle = false;
		titleDraft = '';
	}

	async function saveTitle() {
		if (!list || busy || !editingTitle) return;
		const next = titleDraft.trim();
		if (!next) {
			error = 'Title can’t be empty.';
			titleInputEl?.focus();
			return;
		}
		if (next === list.title) {
			cancelEditTitle();
			return;
		}
		busy = true;
		error = '';
		try {
			list = await updateShoppingListTitle(list.id, next);
			editingTitle = false;
			titleDraft = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update title';
		} finally {
			busy = false;
		}
	}

	const listRecipesOnList = $derived.by(() => {
		if (!list?.recipeCounts) return [];
		const counts = list.recipeCounts;
		return recipes
			.map((recipe) => ({
				recipe,
				count: counts[recipe.id] ?? 0
			}))
			.filter((entry) => entry.count > 0)
			.sort((a, b) => a.recipe.title.localeCompare(b.recipe.title));
	});

	const sharedLabel = $derived(
		list?.sharedWith
			? list.sharedWith.nickname?.trim() ||
					list.sharedWith.name?.trim() ||
					list.sharedWith.email
			: ''
	);

	async function refreshList(silent = false) {
		try {
			const loaded = await getShoppingList(id);
			if (loaded) list = loaded;
		} catch (e) {
			if (!silent) {
				error = e instanceof Error ? e.message : 'Failed to load list';
			}
		}
	}

	onMount(async () => {
		try {
			const [loadedList, loadedRecipes] = await Promise.all([
				getShoppingList(id),
				listRecipes().catch(() => [] as Recipe[])
			]);
			list = loadedList;
			recipes = loadedRecipes;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load list';
		} finally {
			ready = true;
		}

		pollTimer = setInterval(() => {
			if (!busy && !anyDialogOpen && !editingTitle) {
				void refreshList(true);
			}
		}, 8000);

		document.addEventListener('click', onDocClick);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		document.removeEventListener('click', onDocClick);
	});

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (confirmOpen && !el.open) el.showModal();
		if (!confirmOpen && el.open) el.close();
	});

	$effect(() => {
		const el = shareDialogEl;
		if (!el) return;
		if (shareOpen && !el.open) el.showModal();
		if (!shareOpen && el.open) el.close();
	});

	$effect(() => {
		const el = exportDialogEl;
		if (!el) return;
		if (exportOpen && !el.open) el.showModal();
		if (!exportOpen && el.open) el.close();
	});

	$effect(() => {
		const el = importDialogEl;
		if (!el) return;
		if (importOpen && !el.open) el.showModal();
		if (!importOpen && el.open) el.close();
	});

	$effect(() => {
		if (!exportOpen || !exportTextEl) return;
		queueMicrotask(() => {
			exportTextEl?.focus();
			exportTextEl?.select();
		});
	});

	function askDeleteList() {
		if (!list || busy || list.sharedWith) return;
		closeMore();
		confirmMode = 'list';
		pendingItem = null;
		confirmOpen = true;
	}

	function askClearAll() {
		if (!list || busy) return;
		const hasItems = list.items.length > 0;
		const hasRecipes = Object.keys(list.recipeCounts ?? {}).length > 0;
		if (!hasItems && !hasRecipes) return;
		confirmMode = 'clear';
		pendingItem = null;
		confirmOpen = true;
	}

	function askRemoveItem(itemId: string, text: string) {
		if (!list || busy) return;
		confirmMode = 'item';
		pendingItem = { id: itemId, text };
		confirmOpen = true;
	}

	function cancelConfirm() {
		if (busy) return;
		confirmOpen = false;
		pendingItem = null;
	}

	async function confirmAction() {
		if (!list) return;
		busy = true;
		error = '';
		statusMsg = '';
		const wasShared = Boolean(list.sharedWith);
		try {
			if (confirmMode === 'list') {
				await deleteShoppingList(list.id);
				confirmOpen = false;
				goto(wasShared ? `${base}/friends` : `${base}/shopping-lists`);
				return;
			}
			if (confirmMode === 'clear') {
				list = await updateShoppingList(list.id, {
					title: list.title,
					emoji: list.emoji,
					items: [],
					recipeCounts: {}
				});
				statusMsg = 'Cleared all items and recipes from this list.';
				confirmOpen = false;
				pendingItem = null;
				return;
			}
			if (pendingItem) {
				list = await removeShoppingListItem(list.id, pendingItem.id);
			}
			confirmOpen = false;
			pendingItem = null;
		} catch (e) {
			error =
				e instanceof Error
					? e.message
					: confirmMode === 'list'
						? 'Failed to delete'
						: confirmMode === 'clear'
							? 'Failed to clear list'
							: 'Failed to remove item';
			confirmOpen = false;
			pendingItem = null;
		} finally {
			busy = false;
		}
	}

	async function addItem(event: Event) {
		event.preventDefault();
		if (!list) return;
		busy = true;
		error = '';
		statusMsg = '';
		try {
			list = await addShoppingListItem(list.id, newItem);
			newItem = '';
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add item';
		} finally {
			busy = false;
		}
	}

	async function applyPhotoImport(imported: ImportedShoppingList) {
		if (!list) return;
		busy = true;
		error = '';
		statusMsg = '';
		try {
			const existing = list.items.map((item) => item.text);
			const merged = mergeIngredientLists([existing, imported.items]);
			list = await updateShoppingList(list.id, {
				title: list.title,
				emoji: list.emoji,
				items: merged,
				recipeCounts: list.recipeCounts
			});
			statusMsg = `Added ${imported.items.length} item${imported.items.length === 1 ? '' : 's'} from photo.`;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add items from photo';
		} finally {
			busy = false;
		}
	}

	async function toggle(itemId: string) {
		if (!list) return;
		try {
			list = await toggleShoppingListItem(list.id, itemId);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to update item';
		}
	}

	function openExportDialog() {
		if (!list || busy) return;
		closeMore();
		exportCode = encodeShoppingList(list);
		copyMsg = '';
		error = '';
		statusMsg = '';
		exportOpen = true;
	}

	function closeExportDialog() {
		exportOpen = false;
		copyMsg = '';
	}

	async function copyExportCode() {
		if (!exportCode) return;
		try {
			await navigator.clipboard.writeText(exportCode);
			copyMsg = 'Copied to clipboard.';
			exportTextEl?.select();
		} catch {
			exportTextEl?.select();
			copyMsg = 'Select the code and copy it (Ctrl/Cmd+C).';
		}
	}

	function openImportDialog() {
		if (!list || busy) return;
		closeMore();
		importCode = '';
		importError = '';
		error = '';
		statusMsg = '';
		importOpen = true;
	}

	function closeImportDialog() {
		if (busy) return;
		importOpen = false;
		importCode = '';
		importError = '';
	}

	async function confirmImport() {
		if (!list) return;
		const imported = parseShoppingListImport(importCode);
		if (imported.items.length === 0) {
			importError = 'Paste a valid export code (or a list of items).';
			return;
		}

		busy = true;
		importError = '';
		error = '';
		statusMsg = '';
		try {
			const existing = list.items.map((item) => item.text);
			const merged = mergeIngredientLists([existing, imported.items]);
			const recipeCounts = mergeRecipeCounts(list.recipeCounts, imported.recipeCounts);
			list = await updateShoppingList(list.id, {
				title: list.title,
				emoji: list.emoji,
				items: merged,
				recipeCounts
			});
			const recipeN = Object.keys(imported.recipeCounts).length;
			statusMsg =
				recipeN > 0
					? `Imported ${imported.items.length} item${imported.items.length === 1 ? '' : 's'} and ${recipeN} recipe${recipeN === 1 ? '' : 's'}.`
					: `Imported ${imported.items.length} item${imported.items.length === 1 ? '' : 's'} into this list.`;
			importOpen = false;
			importCode = '';
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Failed to import list';
		} finally {
			busy = false;
		}
	}

	async function openShareDialog() {
		if (!list || list.sharedWith || busy) return;
		shareOpen = true;
		selectedFriendId = '';
		error = '';
		statusMsg = '';
		if (friends.length > 0) return;
		friendsLoading = true;
		try {
			friends = await listFriends();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load friends';
			shareOpen = false;
		} finally {
			friendsLoading = false;
		}
	}

	function cancelShare() {
		if (busy) return;
		shareOpen = false;
		selectedFriendId = '';
	}

	async function confirmShareToFriend() {
		if (!list || !selectedFriendId) return;
		busy = true;
		error = '';
		statusMsg = '';
		try {
			const sourceItems = list.items.map((item) => item.text);
			const sourceCounts = list.recipeCounts;
			const shared = await getOrCreateSharedList(selectedFriendId);
			const existing = shared.items.map((item) => item.text);
			const merged = mergeIngredientLists([existing, sourceItems]);
			const recipeCounts = mergeRecipeCounts(shared.recipeCounts, sourceCounts);
			await updateShoppingList(shared.id, {
				title: shared.title,
				emoji: shared.emoji,
				items: merged,
				recipeCounts
			});
			shareOpen = false;
			goto(`${base}/shopping-lists/${shared.id}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to add to shared list';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{pageTitle(listHeading || list?.title || 'Shopping list')}</title>
</svelte:head>

<main class="page">
	<svg class="page__deco" viewBox="0 0 280 320" aria-hidden="true" focusable="false">
		<path
			d="M148 28c-18 34-22 62-14 92 6 22 4 38-8 58-14 24-12 48 4 74 8 14 6 28-2 42"
			fill="none"
			stroke="currentColor"
			stroke-width="7"
			stroke-linecap="round"
		/>
		<path
			d="M134 118c-28-8-52 6-62 28-8 18-4 38 12 48 18 12 28 30 22 52"
			fill="none"
			stroke="currentColor"
			stroke-width="6.5"
			stroke-linecap="round"
		/>
		<path
			d="M156 96c32-10 58 8 66 34 8 24-2 46-24 54-16 6-28 24-24 46"
			fill="none"
			stroke="currentColor"
			stroke-width="6.5"
			stroke-linecap="round"
		/>
		<path
			d="M142 168c-22 18-28 44-16 68 10 20 8 40-4 58"
			fill="none"
			stroke="currentColor"
			stroke-width="6"
			stroke-linecap="round"
		/>
		<circle cx="148" cy="54" r="10" fill="none" stroke="currentColor" stroke-width="5.5" />
	</svg>

	{#if !ready}
		<p class="muted">Loading…</p>
	{:else if !list}
		<p class="muted">{error || 'Shopping list not found.'}</p>
		<a class="text-link" href="{base}/shopping-lists">Back to shopping lists</a>
	{:else}
		<p class="eyebrow">
			{#if list.sharedWith}
				<a href="{base}/friends">← Friends</a>
				<span class="eyebrow__sep" aria-hidden="true">›</span>
				<span>Shared list</span>
			{:else}
				<a href="{base}/shopping-lists">← Shopping Lists</a>
			{/if}
		</p>
		{#if list.sharedWith}
			<p class="shared-banner" role="status">
				Shared with <strong>{sharedLabel}</strong> — updates appear for both of you.
			</p>
		{/if}

		<header class="header">
			<div class="title-row">
				<h1 class="page-title">{listHeading || 'Shopping list'}</h1>
				<div class="actions">
					{#if !list.sharedWith}
						<button type="button" class="btn btn--soft" onclick={openShareDialog} disabled={busy}>
							To shared list
						</button>
						<a class="btn btn--soft" href="{base}/shopping-lists/{list.id}/edit">Edit</a>
					{/if}
					<button
						type="button"
						class="btn btn--soft btn--compact"
						onclick={askClearAll}
						disabled={busy || !canClear}
					>
						Clear all
					</button>
					<div class="more" data-list-more>
						<button
							type="button"
							class="more__trigger"
							aria-label="More list actions"
							aria-expanded={moreOpen}
							aria-haspopup="menu"
							disabled={busy}
							onclick={toggleMore}
						>
							<span aria-hidden="true">⋯</span>
						</button>
						{#if moreOpen}
							<div class="more__panel" role="menu">
								<button
									type="button"
									class="more__item"
									role="menuitem"
									onclick={openExportDialog}
								>
									Export
								</button>
								<button
									type="button"
									class="more__item"
									role="menuitem"
									onclick={openImportDialog}
								>
									Import
								</button>
								{#if !list.sharedWith}
									<button
										type="button"
										class="more__item more__item--danger"
										role="menuitem"
										onclick={askDeleteList}
									>
										Delete list
									</button>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>
			{#if listRecipesOnList.length > 0}
				<ul class="recipe-chips" aria-label="Recipes on this list">
					{#each listRecipesOnList as { recipe, count } (recipe.id)}
						<li>
							<a class="recipe-chip" href="{base}/your-recipes/{recipe.id}">
								<span class="recipe-chip__emoji" aria-hidden="true"
									>{displayEmoji(recipe.emoji)}</span
								>
								<span class="recipe-chip__title">{recipe.title}</span>
								<span class="recipe-chip__count">{count}×</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
			{#if statusMsg}
				<p class="ok" role="status">{statusMsg}</p>
			{/if}
			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}
		</header>

		<div class="workspace" class:workspace--solo={list.items.length === 0}>
			<section class="notebook" aria-label="Shopping list items">
				<div class="notebook__bar" aria-hidden="true"></div>

				<div class="notebook__paper">
					<div class="notebook__heading">
						{#if editingTitle}
							<input
								bind:this={titleInputEl}
								class="notebook__title-input"
								type="text"
								bind:value={titleDraft}
								aria-label="List title"
								maxlength="120"
								disabled={busy}
								onkeydown={(e) => {
									if (e.key === 'Enter') {
										e.preventDefault();
										void saveTitle();
									}
									if (e.key === 'Escape') {
										e.preventDefault();
										cancelEditTitle();
									}
								}}
								onblur={() => void saveTitle()}
							/>
						{:else}
							<button
								type="button"
								class="notebook__title-btn"
								onclick={startEditTitle}
								title="Click to rename"
							>
								<span class="notebook__title">{listHeading || 'Shopping list'}</span>
							</button>
						{/if}
					</div>

					<p class="notebook__count">
						{list.items.filter((item) => item.checked).length} of {list.items.length} checked
					</p>

					{#if list.items.length === 0}
						<p class="notebook__empty">No items yet — add one below, or scan a photo.</p>
					{:else}
						<ul class="items">
							{#each list.items as item (item.id)}
								<li class:checked={item.checked}>
									<label>
										<input
											type="checkbox"
											checked={item.checked}
											onchange={() => toggle(item.id)}
										/>
										<span>{item.text}</span>
									</label>
									<button
										type="button"
										class="remove"
										aria-label="Remove {item.text}"
										onclick={() => askRemoveItem(item.id, item.text)}
										disabled={busy}
									>
										×
									</button>
								</li>
							{/each}
						</ul>
					{/if}

					<form class="add" onsubmit={addItem}>
						<input
							bind:value={newItem}
							type="text"
							placeholder="Add an item"
							aria-label="New item"
						/>
						<button type="submit" class="btn btn--primary" disabled={busy}>Add</button>
					</form>
					<div class="scan-row">
						<ScanListPhoto compact disabled={busy} onimported={applyPhotoImport} />
					</div>
				</div>
			</section>

			{#if list.items.length > 0}
				<div class="estimate-slot">
					<CostEstimatePanel
						lines={list.items.map((item) => item.text)}
						title="Estimated Shopping List Cost"
						persistKey={`list:${list.id}`}
						pricing="packages"
					/>
				</div>
			{/if}
		</div>
	{/if}
</main>

{#if list}
	<dialog
		class="confirm"
		bind:this={dialogEl}
		aria-labelledby="confirm-title"
		aria-describedby="confirm-desc"
		onclose={() => {
			confirmOpen = false;
			pendingItem = null;
		}}
		onclick={(event) => {
			if (event.target === dialogEl) cancelConfirm();
		}}
	>
		<div class="confirm__panel">
			{#if confirmMode === 'list'}
				<h2 id="confirm-title">Delete shopping list?</h2>
				<p id="confirm-desc">
					“{list.title}” will be removed for good. This can’t be undone.
				</p>
			{:else if confirmMode === 'clear'}
				<h2 id="confirm-title">Clear this list?</h2>
				<p id="confirm-desc">
					All items and linked recipes will be removed from this list. The list itself stays.
					{#if list.sharedWith}
						Both of you will see an empty list.
					{/if}
				</p>
			{:else}
				<h2 id="confirm-title">Remove item?</h2>
				<p id="confirm-desc">
					“{pendingItem?.text ?? 'This item'}” will be taken off the list.
				</p>
			{/if}
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={cancelConfirm} disabled={busy}>
					Cancel
				</button>
				<button type="button" class="btn btn--danger" onclick={confirmAction} disabled={busy}>
					{#if busy}
						{confirmMode === 'list'
							? 'Deleting…'
							: confirmMode === 'clear'
								? 'Clearing…'
								: 'Removing…'}
					{:else}
						{confirmMode === 'list' ? 'Delete' : confirmMode === 'clear' ? 'Clear all' : 'Remove'}
					{/if}
				</button>
			</div>
		</div>
	</dialog>

	<dialog
		class="confirm"
		bind:this={shareDialogEl}
		aria-labelledby="share-title"
		aria-describedby="share-desc"
		onclose={() => {
			shareOpen = false;
			selectedFriendId = '';
		}}
		onclick={(event) => {
			if (event.target === shareDialogEl) cancelShare();
		}}
	>
		<div class="confirm__panel">
			<h2 id="share-title">Add to shared list</h2>
			<p id="share-desc">
				Merge this list’s items into your shared shopping list with a friend.
			</p>
			{#if friendsLoading}
				<p class="muted">Loading friends…</p>
			{:else if friends.length === 0}
				<p class="muted">
					No friends yet. Add someone on the
					<a class="text-link" href="{base}/friends">Friends</a> page.
				</p>
			{:else}
				<label class="share-label" for="share-friend">Friend</label>
				<select id="share-friend" class="share-select" bind:value={selectedFriendId}>
					<option value="">Choose a friend…</option>
					{#each friends as friend (friend.id)}
						<option value={friend.id}>{friendDisplayLabel(friend)}</option>
					{/each}
				</select>
			{/if}
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={cancelShare} disabled={busy}>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn--primary"
					onclick={confirmShareToFriend}
					disabled={busy || !selectedFriendId || friends.length === 0}
				>
					{busy ? 'Adding…' : 'Add items'}
				</button>
			</div>
		</div>
	</dialog>

	<dialog
		class="confirm confirm--wide"
		bind:this={exportDialogEl}
		aria-labelledby="export-title"
		aria-describedby="export-desc"
		onclose={() => {
			exportOpen = false;
			copyMsg = '';
		}}
		onclick={(event) => {
			if (event.target === exportDialogEl) closeExportDialog();
		}}
	>
		<div class="confirm__panel">
			<h2 id="export-title">Export list</h2>
			<p id="export-desc">Copy this code, then paste it with Import on another list.</p>
			<label class="share-label" for="export-code">Export code</label>
			<textarea
				id="export-code"
				class="code-box"
				bind:this={exportTextEl}
				readonly
				rows="6"
				bind:value={exportCode}
				onclick={(e) => (e.currentTarget as HTMLTextAreaElement).select()}
			></textarea>
			{#if copyMsg}
				<p class="ok dialog-status" role="status">{copyMsg}</p>
			{/if}
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={closeExportDialog}>Close</button>
				<button type="button" class="btn btn--primary" onclick={copyExportCode}>Copy</button>
			</div>
		</div>
	</dialog>

	<dialog
		class="confirm confirm--wide"
		bind:this={importDialogEl}
		aria-labelledby="import-title"
		aria-describedby="import-desc"
		onclose={() => {
			if (!busy) {
				importOpen = false;
				importCode = '';
				importError = '';
			}
		}}
		onclick={(event) => {
			if (event.target === importDialogEl) closeImportDialog();
		}}
	>
		<div class="confirm__panel">
			<h2 id="import-title">Import list</h2>
			<p id="import-desc">Paste an export code to merge those items (and recipes) into this list.</p>
			<label class="share-label" for="import-code">Export code</label>
			<textarea
				id="import-code"
				class="code-box"
				rows="6"
				placeholder="Paste RSL2.… code here"
				bind:value={importCode}
				disabled={busy}
			></textarea>
			{#if importError}
				<p class="error dialog-status" role="alert">{importError}</p>
			{/if}
			<div class="confirm__actions">
				<button type="button" class="btn btn--ghost" onclick={closeImportDialog} disabled={busy}>
					Cancel
				</button>
				<button
					type="button"
					class="btn btn--primary"
					onclick={confirmImport}
					disabled={busy || !importCode.trim()}
				>
					{busy ? 'Importing…' : 'Import'}
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	.page {
		position: relative;
		width: min(72rem, 100%);
		padding: clamp(1.75rem, 5vh, 3rem) clamp(1.25rem, 4vw, 3rem) clamp(4rem, 10vh, 6rem);
		animation: rise 0.7s var(--ease) both;
		isolation: isolate;
	}

	.page__deco {
		position: absolute;
		right: clamp(-1rem, 2vw, 2rem);
		bottom: clamp(1rem, 6vh, 4rem);
		width: min(22rem, 48vw);
		height: auto;
		color: rgba(27, 107, 69, 0.14);
		pointer-events: none;
		z-index: 0;
	}

	.page > :not(.page__deco) {
		position: relative;
		z-index: 1;
	}

	.eyebrow {
		margin-bottom: 0.65rem;
		font-size: 0.95rem;
		color: var(--ink-soft);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.4rem;
	}

	.eyebrow a {
		color: var(--leaf-deep);
		font-weight: 650;
		text-decoration: none;
	}

	.eyebrow a:hover {
		color: var(--leaf);
	}

	.eyebrow__sep {
		opacity: 0.55;
	}

	.shared-banner {
		margin: 0 0 1rem;
		padding: 0.7rem 0.9rem;
		border-radius: 0.75rem;
		background: rgba(27, 107, 69, 0.1);
		border: 1.5px solid rgba(27, 107, 69, 0.18);
		color: var(--ink-soft);
		font-size: 0.95rem;
	}

	.shared-banner strong {
		color: var(--ink);
		font-weight: 650;
	}

	.header {
		margin-bottom: 1.35rem;
	}

	.title-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.65rem;
	}

	.page-title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: clamp(2rem, 5vw, 2.85rem);
		letter-spacing: -0.045em;
		margin: 0;
		min-width: 0;
		color: var(--leaf-deep);
		line-height: 1.05;
	}

	.recipe-chips {
		list-style: none;
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin: 0 0 0.85rem;
		padding: 0;
	}

	.recipe-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 100%;
		padding: 0.35rem 0.65rem 0.35rem 0.4rem;
		border-radius: 999px;
		border: 1.5px solid rgba(27, 107, 69, 0.18);
		background: rgba(232, 244, 236, 0.95);
		color: var(--leaf-deep);
		text-decoration: none;
		font-size: 0.86rem;
		font-weight: 600;
		transition:
			background 0.15s var(--ease),
			border-color 0.15s var(--ease);
	}

	.recipe-chip:hover {
		background: #e2f0e6;
		border-color: rgba(27, 107, 69, 0.3);
	}

	.recipe-chip__emoji {
		font-size: 1rem;
		line-height: 1;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.recipe-chip__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 12rem;
	}

	.recipe-chip__count {
		font-variant-numeric: tabular-nums;
		font-weight: 800;
		font-size: 0.8rem;
		opacity: 0.85;
	}

	.error {
		color: #8a2f2f;
		margin-bottom: 0.75rem;
	}

	.ok {
		color: var(--leaf-deep);
		margin-bottom: 0.75rem;
		font-size: 0.95rem;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		flex-shrink: 0;
		align-items: center;
	}

	.more {
		position: relative;
	}

	.more__trigger {
		appearance: none;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.7);
		color: var(--ink-soft);
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 0.55rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		line-height: 1;
		cursor: pointer;
	}

	.more__trigger:hover:not(:disabled),
	.more__trigger[aria-expanded='true'] {
		background: rgba(27, 107, 69, 0.1);
		border-color: rgba(27, 107, 69, 0.28);
		color: var(--leaf-deep);
	}

	.more__trigger:disabled {
		opacity: 0.55;
		cursor: wait;
	}

	.more__panel {
		position: absolute;
		top: calc(100% + 0.35rem);
		right: 0;
		z-index: 12;
		min-width: 10.5rem;
		padding: 0.35rem;
		background: #f7fbf8;
		border: 1.5px solid var(--line);
		border-radius: 0.75rem;
		box-shadow: 0 12px 28px rgba(19, 32, 24, 0.12);
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.more__item {
		appearance: none;
		border: none;
		background: transparent;
		font: inherit;
		font-size: 0.9rem;
		font-weight: 600;
		text-align: left;
		padding: 0.55rem 0.7rem;
		border-radius: 0.5rem;
		color: var(--ink);
		cursor: pointer;
		width: 100%;
	}

	.more__item:hover {
		background: rgba(27, 107, 69, 0.1);
		color: var(--leaf-deep);
	}

	.more__item--danger {
		color: #8a2f2f;
	}

	.more__item--danger:hover {
		background: rgba(180, 58, 58, 0.1);
		color: #8a2f2f;
	}

	.btn--compact {
		padding: 0.5rem 0.85rem;
		font-size: 0.88rem;
	}

	.workspace {
		display: grid;
		grid-template-columns: minmax(0, 1.15fr) minmax(18rem, 0.85fr);
		gap: clamp(1.25rem, 3vw, 2rem);
		align-items: start;
	}

	.workspace--solo {
		grid-template-columns: minmax(0, 28rem);
	}

	.estimate-slot {
		position: sticky;
		top: 1rem;
	}

	.notebook {
		background: #fff;
		border-radius: 1rem 1rem 0.35rem 0.35rem;
		box-shadow:
			0 1px 0 rgba(19, 32, 24, 0.04),
			0 14px 36px rgba(19, 32, 24, 0.08);
		overflow: hidden;
		border: 1px solid rgba(19, 32, 24, 0.06);
	}

	.notebook__bar {
		background: var(--leaf-deep);
		height: 1.35rem;
	}

	.notebook__heading {
		display: flex;
		justify-content: center;
		align-items: center;
		height: var(--row);
		padding: 0;
		position: relative;
		z-index: 1;
	}

	.notebook__title-btn {
		appearance: none;
		border: none;
		background: transparent;
		padding: 0.15rem 0.5rem;
		margin: 0;
		cursor: text;
		border-radius: 0.35rem;
		max-width: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.notebook__title-btn:hover .notebook__title {
		opacity: 0.82;
	}

	.notebook__title-btn:focus-visible {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 2px;
	}

	.notebook__title {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.55rem;
		letter-spacing: -0.03em;
		color: var(--leaf-deep);
		line-height: 1;
	}

	.notebook__title-input {
		width: min(100%, 18rem);
		height: calc(var(--row) - 0.4rem);
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.4rem;
		letter-spacing: -0.03em;
		text-align: center;
		padding: 0 0.55rem;
		border-radius: 0.4rem;
		border: 1.5px solid rgba(27, 107, 69, 0.35);
		background: rgba(255, 255, 255, 0.95);
		color: var(--leaf-deep);
		line-height: 1;
	}

	.notebook__title-input:focus {
		outline: 2px solid rgba(27, 107, 69, 0.25);
		outline-offset: 1px;
	}

	.notebook__paper {
		--row: 2.65rem;
		--margin: 3rem;
		position: relative;
		background-color: #fffcf7;
		background-image: repeating-linear-gradient(
			to bottom,
			transparent 0,
			transparent calc(var(--row) - 1px),
			#d5dde2 calc(var(--row) - 1px),
			#d5dde2 var(--row)
		);
		background-position: 0 0;
		min-height: calc(var(--row) * 8);
	}

	.notebook__paper::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: var(--margin);
		width: 2px;
		background: linear-gradient(
			to right,
			rgba(196, 74, 74, 0.55) 0,
			rgba(196, 74, 74, 0.55) 1px,
			transparent 1px,
			transparent 5px,
			rgba(196, 74, 74, 0.4) 5px,
			rgba(196, 74, 74, 0.4) 6px,
			transparent 6px
		);
		pointer-events: none;
	}

	.notebook__count {
		margin: 0;
		padding: 0 0 0 calc(var(--margin) + 0.85rem);
		height: var(--row);
		display: flex;
		align-items: center;
		font-size: 0.84rem;
		line-height: 1;
		color: var(--ink-soft);
		position: relative;
		z-index: 1;
	}

	.notebook__empty {
		margin: 0;
		padding: 0 0 0 calc(var(--margin) + 0.85rem);
		height: var(--row);
		display: flex;
		align-items: center;
		color: var(--ink-soft);
		position: relative;
		z-index: 1;
		line-height: 1;
	}

	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		position: relative;
		z-index: 1;
	}

	.items li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		height: var(--row);
		padding: 0 0.15rem 0 0;
		border: none;
		background: transparent;
		border-radius: 0;
		box-sizing: border-box;
	}

	.items li.checked span {
		text-decoration: line-through;
		color: var(--ink-soft);
		opacity: 0.65;
	}

	.items label {
		display: grid;
		grid-template-columns: var(--margin) minmax(0, 1fr);
		align-items: center;
		flex: 1;
		min-width: 0;
		cursor: pointer;
		height: 100%;
	}

	.items input[type='checkbox'] {
		appearance: none;
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		justify-self: center;
		flex-shrink: 0;
		border: 1.75px solid var(--leaf-deep);
		border-radius: 0.2rem;
		background: transparent;
		cursor: pointer;
		display: grid;
		place-content: center;
		position: relative;
		z-index: 1;
	}

	.items label span {
		min-width: 0;
		padding-left: 0.45rem;
		color: var(--leaf-deep);
		font-weight: 550;
		font-size: 1.02rem;
		line-height: 1;
	}

	.items input[type='checkbox']::before {
		content: '';
		width: 0.45rem;
		height: 0.7rem;
		border: solid var(--leaf-deep);
		border-width: 0 2px 2px 0;
		transform: rotate(45deg) scale(0);
		transition: transform 0.12s var(--ease);
		margin-bottom: 0.15rem;
	}

	.items input[type='checkbox']:checked::before {
		transform: rotate(45deg) scale(1);
	}

	.items input[type='checkbox']:focus-visible {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 2px;
	}

	.remove {
		appearance: none;
		border: none;
		background: transparent;
		color: rgba(180, 58, 58, 0.55);
		font: inherit;
		font-size: 1.35rem;
		font-weight: 500;
		line-height: 1;
		cursor: pointer;
		padding: 0.2rem 0.35rem;
		border-radius: 0.35rem;
		opacity: 0;
		transition: opacity 0.15s var(--ease);
		display: flex;
		align-items: center;
		justify-content: center;
		align-self: center;
	}

	.items li:hover .remove,
	.items li:focus-within .remove {
		opacity: 1;
	}

	.remove:hover:not(:disabled) {
		color: #9c2f2f;
		background: rgba(180, 58, 58, 0.08);
	}

	.remove:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}

	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.55rem;
		height: var(--row);
		margin-top: 0;
		padding-left: calc(var(--margin) + 0.85rem);
		position: relative;
		z-index: 1;
	}

	.add input {
		flex: 1;
		min-width: 10rem;
		height: calc(var(--row) - 0.55rem);
		font: inherit;
		padding: 0 0.7rem;
		border-radius: 0.45rem;
		border: 1.5px dashed rgba(27, 107, 69, 0.28);
		background: rgba(255, 255, 255, 0.72);
		color: var(--ink);
		line-height: 1;
		box-sizing: border-box;
	}

	.add input:focus {
		outline: none;
		border-style: solid;
		border-color: rgba(27, 107, 69, 0.4);
		background: #fff;
	}

	.add .btn {
		height: calc(var(--row) - 0.55rem);
		padding-top: 0;
		padding-bottom: 0;
		box-sizing: border-box;
	}

	.scan-row {
		padding: 0.15rem 0.85rem 0.85rem calc(var(--margin) + 0.85rem);
		position: relative;
		z-index: 1;
	}

	.share-label {
		display: block;
		font-size: 0.88rem;
		font-weight: 600;
		margin-bottom: 0.35rem;
	}

	.share-select {
		width: 100%;
		font: inherit;
		padding: 0.65rem 0.75rem;
		border-radius: 0.55rem;
		border: 1.5px solid var(--line);
		background: #fff;
		color: var(--ink);
		margin-bottom: 1.1rem;
	}

	.code-box {
		width: 100%;
		font-family: ui-monospace, 'Cascadia Code', 'Segoe UI Mono', Menlo, monospace;
		font-size: 0.78rem;
		line-height: 1.4;
		padding: 0.75rem 0.85rem;
		border-radius: 0.65rem;
		border: 1.5px solid var(--line);
		background: #fff;
		color: var(--ink);
		resize: vertical;
		min-height: 7.5rem;
		margin-bottom: 0.35rem;
		word-break: break-all;
	}

	.code-box:focus {
		outline: 2px solid rgba(27, 107, 69, 0.35);
		outline-offset: 1px;
	}

	.dialog-status {
		margin-top: 0.35rem;
		margin-bottom: 0.85rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.75rem 1.1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}

	.btn--primary {
		background: var(--leaf-deep);
		color: #f7fbf8;
	}

	.btn--soft {
		background: var(--mist);
		color: var(--leaf-deep);
	}

	.btn--danger {
		background: #b43a3a;
		color: #fff8f8;
	}

	.btn--danger:hover:not(:disabled) {
		background: #9c2f2f;
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.confirm {
		position: fixed;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0;
		border: none;
		border-radius: 1.1rem;
		background: transparent;
		max-width: min(24rem, calc(100vw - 2rem));
	}

	.confirm.confirm--wide {
		width: min(32rem, calc(100vw - 2rem));
		max-width: min(32rem, calc(100vw - 2rem));
	}

	.confirm::backdrop {
		background: rgba(19, 32, 24, 0.45);
		backdrop-filter: blur(4px);
	}

	.confirm__panel {
		padding: 1.35rem 1.4rem 1.25rem;
		background: #f7fbf8;
		border: 1px solid rgba(19, 32, 24, 0.08);
		border-radius: 1.1rem;
		box-shadow: 0 18px 40px rgba(19, 32, 24, 0.18);
		animation: rise 0.28s var(--ease) both;
	}

	.confirm__panel h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.35rem;
		letter-spacing: -0.03em;
		margin-bottom: 0.45rem;
	}

	.confirm__panel p {
		color: var(--ink-soft);
		font-size: 0.98rem;
		line-height: 1.45;
		margin-bottom: 1.2rem;
	}

	.confirm__actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.55rem;
	}

	.muted {
		color: var(--ink-soft);
		margin-bottom: 0.75rem;
	}

	.text-link {
		color: var(--leaf-deep);
		font-weight: 600;
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

	@media (max-width: 860px) {
		.workspace {
			grid-template-columns: 1fr;
		}

		.estimate-slot {
			position: static;
		}

		.page__deco {
			width: min(16rem, 70vw);
			opacity: 0.7;
		}
	}

	@media (max-width: 560px) {
		.title-row {
			flex-direction: column;
			align-items: stretch;
		}

		.notebook__paper {
			--margin: 2.55rem;
			padding-left: 0.65rem;
			padding-right: 0.65rem;
		}

		.remove {
			opacity: 0.7;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.page,
		.confirm__panel {
			animation: none;
		}
	}
</style>
