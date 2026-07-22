<script lang="ts">
	import IconPenEditor from '$lib/components/IconPenEditor.svelte';
	import { FOOD_EMOJI, isCustomIcon } from '$lib/emoji';

	type Props = {
		value?: string;
		name?: string;
		label?: string;
		fallback?: string;
		onchange?: (value: string) => void;
	};

	let {
		value = $bindable(''),
		name = 'emoji',
		label = 'Icon',
		fallback = '🍽️',
		onchange
	}: Props = $props();

	let drawOpen = $state(false);
	const custom = $derived(isCustomIcon(value));
	const textValue = $derived(custom ? '' : value);

	function pick(emoji: string) {
		value = emoji;
		onchange?.(emoji);
	}

	function onTextInput(event: Event) {
		const next = (event.currentTarget as HTMLInputElement).value;
		value = next;
		onchange?.(next);
	}

	function onDrawn(dataUrl: string) {
		value = dataUrl;
		onchange?.(dataUrl);
	}
</script>

<div class="emoji-field">
	<span class="label">{label}</span>
	<div class="row">
		{#if custom}
			<input type="hidden" {name} {value} />
			<span class="preview preview--custom" aria-hidden="true">
				<img src={value} alt="" width="36" height="36" />
			</span>
			<span class="custom-tag">Custom</span>
		{:else}
			<input
				class="emoji-input"
				type="text"
				{name}
				value={textValue}
				maxlength="8"
				placeholder={fallback}
				aria-label={label}
				autocomplete="off"
				spellcheck="false"
				oninput={onTextInput}
			/>
			<span class="preview" aria-hidden="true">{value.trim() || fallback}</span>
		{/if}
		<button type="button" class="draw-btn" onclick={() => (drawOpen = true)}>Draw</button>
	</div>
	<div class="picks" role="listbox" aria-label="Emoji suggestions">
		{#each FOOD_EMOJI as emoji}
			<button
				type="button"
				class="pick"
				class:active={!custom && value === emoji}
				onclick={() => pick(emoji)}
			>
				{emoji}
			</button>
		{/each}
	</div>
</div>

<IconPenEditor bind:open={drawOpen} onsave={onDrawn} />

<style>
	.emoji-field {
		display: grid;
		gap: 0.45rem;
	}

	.label {
		font-weight: 600;
		font-size: 0.92rem;
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		flex-wrap: wrap;
	}

	.emoji-input {
		width: 5.5rem;
		font: inherit;
		font-size: 1.35rem;
		line-height: 1.2;
		text-align: center;
		color: var(--ink);
		background: rgba(255, 255, 255, 0.72);
		border: 1.5px solid var(--line);
		border-radius: 0.55rem;
		padding: 0.55rem 0.4rem;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', var(--font-body), sans-serif;
	}

	.preview {
		font-size: 1.75rem;
		line-height: 1;
		font-family:
			'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
	}

	.preview--custom {
		width: 2.35rem;
		height: 2.35rem;
		border-radius: 0.55rem;
		overflow: hidden;
		background: #fff;
		border: 1px solid rgba(19, 32, 24, 0.1);
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.preview--custom img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.custom-tag {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--leaf-deep);
		background: var(--mist);
		border-radius: 0.4rem;
		padding: 0.25rem 0.5rem;
	}

	.draw-btn {
		appearance: none;
		border: 1.5px solid var(--line);
		background: rgba(255, 255, 255, 0.65);
		color: var(--ink-soft);
		font: inherit;
		font-weight: 600;
		font-size: 0.85rem;
		border-radius: 0.5rem;
		padding: 0.45rem 0.75rem;
		cursor: pointer;
	}

	.draw-btn:hover {
		border-color: rgba(27, 107, 69, 0.35);
		color: var(--leaf-deep);
		background: var(--mist);
	}

	.picks {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.pick {
		appearance: none;
		border: 1.5px solid transparent;
		background: rgba(255, 255, 255, 0.55);
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

	.pick:hover,
	.pick.active {
		border-color: rgba(27, 107, 69, 0.35);
		background: var(--mist);
	}
</style>
