const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.82;
const MAX_RAW_BYTES = 3_200_000;

function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error('Could not read that photo.'));
		reader.onload = () => {
			const result = String(reader.result ?? '');
			const comma = result.indexOf(',');
			resolve(comma >= 0 ? result.slice(comma + 1) : result);
		};
		reader.readAsDataURL(blob);
	});
}

function normalizeMime(type: string): string {
	const mime = type.trim().toLowerCase();
	if (mime === 'image/jpg') return 'image/jpeg';
	if (mime.startsWith('image/')) return mime;
	return 'image/jpeg';
}

/** Shrink a photo so it fits Gemini + the API body limit. */
export async function fileToInlineImage(file: File): Promise<{ mimeType: string; data: string }> {
	if (file.size === 0) {
		throw new Error('That photo is empty — try another one.');
	}

	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const canvas = document.createElement('canvas');
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext('2d');
		if (!ctx) {
			bitmap.close();
			throw new Error('Could not read that photo.');
		}
		ctx.drawImage(bitmap, 0, 0, width, height);
		bitmap.close();
		const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
		const data = dataUrl.slice(dataUrl.indexOf(',') + 1);
		if (!data) {
			throw new Error('Could not read that photo.');
		}
		return { mimeType: 'image/jpeg', data };
	} catch (error) {
		if (file.size > MAX_RAW_BYTES) {
			throw new Error('That photo is too large. Try a closer shot or a smaller image.');
		}
		if (error instanceof Error && error.message.startsWith('That photo')) {
			throw error;
		}
		const mimeType = normalizeMime(file.type || 'image/jpeg');
		return { mimeType, data: await blobToBase64(file) };
	}
}
