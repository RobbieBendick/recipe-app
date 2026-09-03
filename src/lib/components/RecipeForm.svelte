<script lang="ts">
	import { untrack } from 'svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
	import { importRecipeFromUrl } from '$lib/recipes-api';
	import type { RecipeInput } from '$lib/types';
	import { linesToList, listToLines } from '$lib/util';

	type Props = {
		initial?: RecipeInput;
		submitLabel?: string;
		cancelHref?: string;
		error?: string;
		onsubmit: (input: RecipeInput) => void | Promise<void>;
	};

	let {
		initial = {
			title: '',
			description: '',
			emoji: '🍽️',
			ingredients: [],
			steps: [],
			prepMinutes: 0,
			cookMinutes: 0,
			servings: 0
		},
		submitLabel = 'Save recipe',
		cancelHref,
		error = '',
		onsubmit
	}: Props = $props();

	let title = $state(untrack(() => initial.title));
	let description = $state(untrack(() => initial.description));
	let emoji = $state(untrack(() => initial.emoji || '🍽️'));
	let ingredientsText = $state(untrack(() => listToLines(initial.ingredients)));
	let stepsText = $state(untrack(() => listToLines(initial.steps)));
	let prepMinutes = $state(untrack(() => initial.prepMinutes ?? 0));
	let cookMinutes = $state(untrack(() => initial.cookMinutes ?? 0));
	let servings = $state(untrack(() => initial.servings ?? 0));
	let localError = $state('');
	let importUrl = $state('');
	let importing = $state(false);
	let importNote = $state('');

	async function handleImport() {
		const url = importUrl.trim();
		if (!url) {
			localError = 'Paste a recipe link first.';
			importNote = '';
			return;
		}
		importing = true;
		localError = '';
		importNote = '';
		try {
			const imported = await importRecipeFromUrl(url);
			if (imported.title) title = imported.title;
			if (imported.description) description = imported.description;
			if (imported.ingredients?.length) {
				ingredientsText = listToLines(imported.ingredients);
			}
			if (imported.steps?.length) {
				stepsText = listToLines(imported.steps);
			}
			if (imported.prepMinutes > 0) prepMinutes = imported.prepMinutes;
			if (imported.cookMinutes > 0) cookMinutes = imported.cookMinutes;
			if (imported.servings > 0) servings = imported.servings;

			const filled: string[] = [];
			if (imported.title) filled.push('title');
			if (imported.description) filled.push('description');
			if (imported.prepMinutes > 0 || imported.cookMinutes > 0 || imported.servings > 0) {
				filled.push('times/servings');
			}
			if (imported.ingredients?.length) filled.push('ingredients');
			if (imported.steps?.length) filled.push('steps');
			importNote =
				filled.length > 0
					? `Filled in ${filled.join(', ')}. Review and edit anything that looks off.`
					: 'Found the page, but little recipe detail — fill in the rest manually.';
		} catch (e) {
			localError = e instanceof Error ? e.message : 'Failed to import from that URL';
		} finally {
			importing = false;
		}
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		const trimmedTitle = title.trim();
		if (!trimmedTitle) {
			localError = 'Give your recipe a name.';
			return;
		}
		localError = '';
		await onsubmit({
			title: trimmedTitle,
			description: description.trim(),
			emoji: emoji.trim() || '🍽️',
			ingredients: linesToList(ingredientsText),
			steps: linesToList(stepsText),
			prepMinutes: Math.max(0, Math.round(Number(prepMinutes) || 0)),
			cookMinutes: Math.max(0, Math.round(Number(cookMinutes) || 0)),
			servings: Math.max(0, Math.round(Number(servings) || 0))
		});
	}
</script>

<form class="form" onsubmit={handleSubmit}>
	{#if error || localError}
		<p class="error" role="alert">{error || localError}</p>
	{/if}

	<div class="import">
		<label>
			<span>Import from URL</span>
			<div class="import-row">
				<input
					bind:value={importUrl}
					type="url"
					name="importUrl"
					placeholder="https://instagram.com/reel/... or any recipe link"
					inputmode="url"
					autocomplete="url"
					disabled={importing}
				/>
				<button
					type="button"
					class="btn btn--ghost"
					onclick={handleImport}
					disabled={importing}
				>
					{importing ? 'Importing…' : 'Import'}
				</button>
			</div>
		</label>
		{#if importNote}
			<p class="import-note" role="status">{importNote}</p>
		{:else}
			<p class="import-hint">Works with recipe sites, Instagram Reels, and Facebook Reels — we read the caption/description and fill what we can.</p>
		{/if}
	</div>

	<EmojiPicker bind:value={emoji} label="Recipe icon" fallback="🍽️" />

	<label>
		<span>Title</span>
		<input
			bind:value={title}
			type="text"
			name="title"
			required
			placeholder="🍝 Weeknight pasta"
		/>
	</label>

	<label>
		<span>Description</span>
		<textarea
			bind:value={description}
			name="description"
			rows="3"
			placeholder="A short note about this dish"
		></textarea>
	</label>

	<div class="meta-grid">
		<label>
			<span>Prep (mins)</span>
			<input bind:value={prepMinutes} type="number" min="0" max="9999" step="1" name="prepMinutes" />
		</label>
		<label>
			<span>Cook (mins)</span>
			<input bind:value={cookMinutes} type="number" min="0" max="9999" step="1" name="cookMinutes" />
		</label>
		<label>
			<span>Servings</span>
			<input bind:value={servings} type="number" min="0" max="999" step="1" name="servings" />
		</label>
	</div>

	<label>
		<span>Ingredients</span>
		<textarea
			bind:value={ingredientsText}
			name="ingredients"
			rows="8"
			placeholder={"One ingredient per line — emoji welcome\n🥚 2 eggs\n🧈 1 tbsp butter\n🧄 2 cloves garlic"}
		></textarea>
	</label>

	<label>
		<span>Steps</span>
		<textarea
			bind:value={stepsText}
			name="steps"
			rows="8"
			placeholder={"One step per line\nPreheat the oven\nMix the dry ingredients"}
		></textarea>
	</label>

	<div class="actions">
		<button type="submit" class="btn btn--primary">{submitLabel}</button>
		{#if cancelHref}
			<a class="btn btn--ghost" href={cancelHref}>Cancel</a>
		{/if}
	</div>
</form>

<style>
	.form {
		display: grid;
		gap: 1.15rem;
		max-width: 36rem;
	}

	.import {
		display: grid;
		gap: 0.45rem;
		padding-bottom: 0.35rem;
		border-bottom: 1px solid var(--line);
		margin-bottom: 0.15rem;
	}

	.import-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.55rem;
		align-items: stretch;
	}

	.import-hint,
	.import-note {
		margin: 0;
		font-size: 0.88rem;
		color: var(--ink-soft);
	}

	.import-note {
		color: var(--leaf-deep, var(--leaf));
	}

	.meta-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.75rem;
	}

	@media (max-width: 520px) {
		.meta-grid {
			grid-template-columns: 1fr;
		}

		.import-row {
			grid-template-columns: 1fr;
		}
	}

	.error {
		color: #8a2f2f;
		background: rgba(138, 47, 47, 0.08);
		border: 1px solid rgba(138, 47, 47, 0.2);
		border-radius: 0.55rem;
		padding: 0.75rem 0.9rem;
		font-size: 0.95rem;
	}

	label {
		display: grid;
		gap: 0.4rem;
	}

	label span {
		font-weight: 600;
		font-size: 0.92rem;
	}

	input,
	textarea {
		width: 100%;
		font: inherit;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.72);
		border: 1.5px solid var(--line);
		border-radius: 0.55rem;
		padding: 0.75rem 0.85rem;
		resize: vertical;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', var(--font-body), sans-serif;
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--leaf);
	}

	input:disabled,
	button:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 0.35rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.85rem 1.2rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
	}

	.btn--primary {
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn--primary:hover:not(:disabled) {
		background: var(--leaf-deep);
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}

	.btn--ghost:hover:not(:disabled) {
		border-color: var(--leaf);
		color: var(--ink);
	}
</style>
