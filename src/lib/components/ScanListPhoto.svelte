<script lang="ts">
	import { fileToInlineImage } from '$lib/image-file';
	import { ApiError } from '$lib/api';
	import { importShoppingListFromImage } from '$lib/shopping-lists-api';
	import type { ImportedShoppingList } from '$lib/types';

	type Props = {
		disabled?: boolean;
		compact?: boolean;
		onimported: (result: ImportedShoppingList) => void | Promise<void>;
	};

	let { disabled = false, compact = false, onimported }: Props = $props();

	let galleryEl = $state<HTMLInputElement | null>(null);
	let cameraEl = $state<HTMLInputElement | null>(null);
	let reading = $state(false);
	let note = $state('');
	let localError = $state('');

	async function onFile(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file || reading || disabled) return;

		reading = true;
		localError = '';
		note = 'Reading photo…';
		try {
			const { mimeType, data } = await fileToInlineImage(file);
			const imported = await importShoppingListFromImage(data, mimeType);
			note = `Found ${imported.items.length} item${imported.items.length === 1 ? '' : 's'}. Review and edit anything that looks off.`;
			await onimported(imported);
		} catch (e) {
			note = '';
			if (e instanceof ApiError && (e.status === 404 || e.status === 405)) {
				localError = 'Photo import isn’t on the server yet. Add items by hand for now.';
			} else {
				localError = e instanceof Error ? e.message : 'Failed to read that photo';
			}
		} finally {
			reading = false;
		}
	}

	function pickPhoto() {
		galleryEl?.click();
	}

	function takePicture() {
		cameraEl?.click();
	}
</script>

<div class="scan" class:scan--compact={compact}>
	<input
		bind:this={galleryEl}
		class="scan__file"
		type="file"
		accept="image/*"
		aria-label="Choose a photo of a shopping list or groceries"
		disabled={disabled || reading}
		onchange={onFile}
	/>
	<input
		bind:this={cameraEl}
		class="scan__file"
		type="file"
		accept="image/*"
		capture="environment"
		aria-label="Take a picture of a shopping list or groceries"
		disabled={disabled || reading}
		onchange={onFile}
	/>

	{#if !compact}
		<div class="scan__copy">
			<span class="scan__label">Create from a photo</span>
			<p class="scan__hint">
				Snap a handwritten list, a receipt, or the groceries themselves — we’ll turn what we
				see into list items.
			</p>
		</div>
	{/if}

	<div class="scan__actions">
		<button
			type="button"
			class="btn btn--primary scan__camera"
			onclick={takePicture}
			disabled={disabled || reading}
		>
			{reading ? 'Reading…' : 'Take a picture'}
		</button>
		<button
			type="button"
			class="btn btn--ghost"
			onclick={pickPhoto}
			disabled={disabled || reading}
		>
			{reading ? 'Reading…' : 'Choose photo'}
		</button>
	</div>

	{#if localError}
		<p class="scan__error" role="alert">{localError}</p>
	{:else if note}
		<p class="scan__note" role="status">{note}</p>
	{/if}
</div>

<style>
	.scan {
		display: grid;
		gap: 0.55rem;
		position: relative;
	}

	.scan--compact {
		gap: 0.4rem;
	}

	.scan__file {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.scan__copy {
		display: grid;
		gap: 0.2rem;
	}

	.scan__label {
		font-weight: 600;
		font-size: 0.85rem;
		color: var(--ink-soft);
	}

	.scan__hint,
	.scan__note,
	.scan__error {
		margin: 0;
		font-size: 0.88rem;
		color: var(--ink-soft);
	}

	.scan__note {
		color: var(--leaf-deep);
	}

	.scan__error {
		color: #8a2f2f;
	}

	.scan__actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.7rem;
		padding: 0.75rem 1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		white-space: nowrap;
		width: fit-content;
	}

	.btn:disabled {
		opacity: 0.55;
		cursor: not-allowed;
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
		border: 1px solid rgba(19, 32, 24, 0.12);
		color: var(--ink-soft);
	}

	.btn--ghost:hover:not(:disabled) {
		border-color: rgba(27, 107, 69, 0.4);
		color: var(--ink);
	}

	.scan__camera {
		display: none;
	}

	@media (hover: none) and (pointer: coarse), (max-width: 800px) {
		.scan__camera {
			display: inline-flex;
		}
	}

	.scan--compact .btn {
		border-radius: 0.45rem;
		padding: 0 0.85rem;
		height: calc(var(--row, 2.75rem) - 0.55rem);
		font-size: 0.9rem;
	}
</style>
