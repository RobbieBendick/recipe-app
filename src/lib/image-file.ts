const MAX_EDGE = 1024;
const JPEG_QUALITY = 0.72;
const MAX_BASE64_CHARS = 2_800_000;

function canvasToJpeg(canvas: HTMLCanvasElement): string {
	const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
	const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
	if (!data) {
		throw new Error('Could not read that photo.');
	}
	return data;
}

function drawToCanvas(
	source: CanvasImageSource,
	width: number,
	height: number
): HTMLCanvasElement {
	const canvas = document.createElement('canvas');
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Could not read that photo.');
	}
	ctx.drawImage(source, 0, 0, width, height);
	return canvas;
}

function scaledSize(width: number, height: number): { width: number; height: number } {
	const scale = Math.min(1, MAX_EDGE / Math.max(width, height, 1));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale))
	};
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('Could not read that photo.'));
		img.src = url;
	});
}

async function compressWithBitmap(file: File): Promise<string> {
	const bitmap = await createImageBitmap(file);
	try {
		const { width, height } = scaledSize(bitmap.width, bitmap.height);
		return canvasToJpeg(drawToCanvas(bitmap, width, height));
	} finally {
		bitmap.close();
	}
}

async function compressWithImageElement(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const img = await loadImageElement(url);
		const { width, height } = scaledSize(img.naturalWidth || img.width, img.naturalHeight || img.height);
		return canvasToJpeg(drawToCanvas(img, width, height));
	} finally {
		URL.revokeObjectURL(url);
	}
}

/** Shrink a photo so it fits Gemini + the API body limit. */
export async function fileToInlineImage(file: File): Promise<{ mimeType: string; data: string }> {
	// Android camera captures often report size 0 even when the bytes are readable.
	let data = '';
	try {
		data = await compressWithBitmap(file);
	} catch {
		data = await compressWithImageElement(file);
	}

	if (!data) {
		throw new Error('Could not read that photo.');
	}
	if (data.length > MAX_BASE64_CHARS) {
		throw new Error('That photo is still too large after shrinking. Try a closer shot.');
	}

	return { mimeType: 'image/jpeg', data };
}
