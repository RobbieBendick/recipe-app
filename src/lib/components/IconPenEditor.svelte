<script lang="ts">
	type Props = {
		open?: boolean;
		title?: string;
		onsave?: (dataUrl: string) => void;
		oncancel?: () => void;
	};

	let {
		open = $bindable(false),
		title = 'Draw an icon',
		onsave,
		oncancel
	}: Props = $props();

	const SIZE = 128;
	const COLORS = ['#132018', '#1b6b45', '#b43a3a', '#c47a1a', '#2f5f8a', '#6b3fa0', '#ffffff'];

	let dialogEl = $state<HTMLDialogElement | null>(null);
	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let strokeWidth = $state(6);
	let color = $state(COLORS[0]);
	let drawing = false;
	let lastX = 0;
	let lastY = 0;

	$effect(() => {
		const el = dialogEl;
		if (!el) return;
		if (open && !el.open) {
			el.showModal();
			queueMicrotask(() => setupCanvas());
		}
		if (!open && el.open) el.close();
	});

	function setupCanvas() {
		const canvas = canvasEl;
		if (!canvas) return;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = SIZE * dpr;
		canvas.height = SIZE * dpr;
		canvas.style.width = `${SIZE}px`;
		canvas.style.height = `${SIZE}px`;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, SIZE, SIZE);
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
	}

	function getCtx() {
		return canvasEl?.getContext('2d') ?? null;
	}

	function pointFromEvent(event: PointerEvent) {
		const canvas = canvasEl;
		if (!canvas) return { x: 0, y: 0 };
		const rect = canvas.getBoundingClientRect();
		return {
			x: ((event.clientX - rect.left) / rect.width) * SIZE,
			y: ((event.clientY - rect.top) / rect.height) * SIZE
		};
	}

	function onPointerDown(event: PointerEvent) {
		const canvas = canvasEl;
		const ctx = getCtx();
		if (!canvas || !ctx) return;
		canvas.setPointerCapture(event.pointerId);
		drawing = true;
		const { x, y } = pointFromEvent(event);
		lastX = x;
		lastY = y;
		ctx.strokeStyle = color;
		ctx.lineWidth = Number(strokeWidth);
		ctx.beginPath();
		ctx.moveTo(x, y);
		ctx.lineTo(x + 0.01, y);
		ctx.stroke();
	}

	function onPointerMove(event: PointerEvent) {
		if (!drawing) return;
		const ctx = getCtx();
		if (!ctx) return;
		const { x, y } = pointFromEvent(event);
		ctx.strokeStyle = color;
		ctx.lineWidth = Number(strokeWidth);
		ctx.beginPath();
		ctx.moveTo(lastX, lastY);
		ctx.lineTo(x, y);
		ctx.stroke();
		lastX = x;
		lastY = y;
	}

	function onPointerUp(event: PointerEvent) {
		drawing = false;
		canvasEl?.releasePointerCapture(event.pointerId);
	}

	function clearCanvas() {
		setupCanvas();
	}

	function cancel() {
		open = false;
		oncancel?.();
	}

	function save() {
		const canvas = canvasEl;
		if (!canvas) return;
		const dataUrl = canvas.toDataURL('image/png');
		onsave?.(dataUrl);
		open = false;
	}
</script>

<dialog
	class="pen"
	bind:this={dialogEl}
	aria-labelledby="pen-title"
	onclose={() => {
		open = false;
	}}
	onclick={(event) => {
		if (event.target === dialogEl) cancel();
	}}
>
	<div class="pen__panel">
		<h2 id="pen-title">{title}</h2>
		<p class="pen__hint">Sketch a simple icon, then save it to this item.</p>

		<canvas
			bind:this={canvasEl}
			class="pen__canvas"
			width={SIZE}
			height={SIZE}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
			aria-label="Drawing canvas"
		></canvas>

		<div class="pen__controls">
			<label class="pen__width">
				<span>Width</span>
				<input type="range" min="2" max="18" step="1" bind:value={strokeWidth} />
				<em style={`--sw: ${strokeWidth}px; --sc: ${color}`} aria-hidden="true"></em>
			</label>

			<div class="pen__colors" role="listbox" aria-label="Stroke color">
				{#each COLORS as swatch}
					<button
						type="button"
						class="swatch"
						class:active={color === swatch}
						class:light={swatch === '#ffffff'}
						style={`--c: ${swatch}`}
						aria-label="Color {swatch}"
						onclick={() => (color = swatch)}
					></button>
				{/each}
				<label class="swatch swatch--custom" title="Custom color">
					<span class="sr-only">Custom color</span>
					<input type="color" bind:value={color} aria-label="Custom stroke color" />
				</label>
			</div>
		</div>

		<div class="pen__actions">
			<button type="button" class="btn btn--ghost" onclick={clearCanvas}>Clear</button>
			<button type="button" class="btn btn--ghost" onclick={cancel}>Cancel</button>
			<button type="button" class="btn btn--primary" onclick={save}>Save</button>
		</div>
	</div>
</dialog>

<style>
	.pen {
		position: fixed;
		inset: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		padding: 0;
		border: none;
		border-radius: 1.1rem;
		background: transparent;
		max-width: min(22rem, calc(100vw - 2rem));
	}

	.pen::backdrop {
		background: rgba(19, 32, 24, 0.45);
		backdrop-filter: blur(4px);
	}

	.pen__panel {
		padding: 1.25rem 1.3rem 1.15rem;
		background: #f7fbf8;
		border: 1px solid rgba(19, 32, 24, 0.08);
		border-radius: 1.1rem;
		box-shadow: 0 18px 40px rgba(19, 32, 24, 0.18);
		display: grid;
		gap: 0.85rem;
		justify-items: center;
	}

	.pen__panel h2 {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.3rem;
		letter-spacing: -0.03em;
		justify-self: start;
		margin: 0;
	}

	.pen__hint {
		justify-self: start;
		margin: 0;
		color: var(--ink-soft);
		font-size: 0.92rem;
		line-height: 1.4;
	}

	.pen__canvas {
		display: block;
		width: 128px;
		height: 128px;
		border-radius: 0.85rem;
		border: 1.5px solid rgba(19, 32, 24, 0.12);
		background: #fff;
		cursor: crosshair;
		touch-action: none;
		box-shadow: inset 0 1px 2px rgba(19, 32, 24, 0.04);
	}

	.pen__controls {
		width: 100%;
		display: grid;
		gap: 0.75rem;
	}

	.pen__width {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.55rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--ink-soft);
	}

	.pen__width input {
		width: 100%;
		accent-color: var(--leaf);
	}

	.pen__width em {
		width: 1.35rem;
		height: 1.35rem;
		border-radius: 50%;
		background: var(--sc);
		box-shadow: inset 0 0 0 1px rgba(19, 32, 24, 0.15);
		position: relative;
	}

	.pen__width em::after {
		content: '';
		position: absolute;
		inset: 50%;
		width: var(--sw);
		height: var(--sw);
		border-radius: 50%;
		background: var(--sc);
		transform: translate(-50%, -50%);
		box-shadow: 0 0 0 1px rgba(19, 32, 24, 0.2);
	}

	.pen__colors {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
	}

	.swatch {
		appearance: none;
		width: 1.65rem;
		height: 1.65rem;
		border-radius: 50%;
		border: 2px solid transparent;
		background: var(--c);
		cursor: pointer;
		padding: 0;
	}

	.swatch.light {
		box-shadow: inset 0 0 0 1px rgba(19, 32, 24, 0.2);
	}

	.swatch.active {
		border-color: var(--leaf);
		box-shadow: 0 0 0 2px rgba(27, 107, 69, 0.2);
	}

	.swatch--custom {
		overflow: hidden;
		position: relative;
		background: conic-gradient(
			from 0deg,
			#f44,
			#fd0,
			#4c4,
			#2af,
			#a4f,
			#f44
		);
	}

	.swatch--custom input {
		position: absolute;
		inset: -0.35rem;
		width: calc(100% + 0.7rem);
		height: calc(100% + 0.7rem);
		border: none;
		padding: 0;
		cursor: pointer;
		opacity: 0;
	}

	.pen__actions {
		width: 100%;
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.btn {
		appearance: none;
		border: none;
		border-radius: 0.55rem;
		padding: 0.65rem 1rem;
		font: inherit;
		font-weight: 600;
		cursor: pointer;
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

	.sr-only {
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
</style>
