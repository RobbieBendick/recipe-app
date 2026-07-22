<script lang="ts">
	import { untrack } from 'svelte';
	import EmojiPicker from '$lib/components/EmojiPicker.svelte';
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
		initial = { title: '', description: '', emoji: '🍽️', ingredients: [], steps: [] },
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
	let localError = $state('');

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
			steps: linesToList(stepsText)
		});
	}
</script>

<form class="form" onsubmit={handleSubmit}>
	{#if error || localError}
		<p class="error" role="alert">{error || localError}</p>
	{/if}

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
	}

	.btn--primary {
		background: var(--leaf);
		color: #f7fbf8;
	}

	.btn--primary:hover {
		background: var(--leaf-deep);
	}

	.btn--ghost {
		background: transparent;
		border: 1.5px solid var(--line);
		color: var(--ink-soft);
	}
</style>
