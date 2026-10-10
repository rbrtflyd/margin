export const MAX_EDGE = 2048;
export const IMAGE_FIT = 320;
export const ASSET_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function fitWithin(
  w: number,
  h: number,
  max = MAX_EDGE,
): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const long = Math.max(w, h);
  if (long <= max) return { w: Math.round(w), h: Math.round(h) };
  const s = max / long;
  return {
    w: Math.max(1, Math.round(w * s)),
    h: Math.max(1, Math.round(h * s)),
  };
}

/** World-unit size: long side is `target` (default 320). */
export function boardSize(
  w: number,
  h: number,
  target = IMAGE_FIT,
): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: target, h: target };
  const s = target / Math.max(w, h);
  return {
    w: Math.max(1, Math.round(w * s)),
    h: Math.max(1, Math.round(h * s)),
  };
}

export async function uploadAsset(blob: Blob, uploadUrl: string): Promise<string> {
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': blob.type || 'image/webp' },
    body: blob,
  });
  if (!res.ok) throw new Error('Upload failed');
  const data = (await res.json()) as { storageId?: string };
  if (!data.storageId) throw new Error('Upload failed');
  return data.storageId;
}

export function referencedAssetIds(
  items: { assetId?: string }[],
): Set<string> {
  const ids = new Set<string>();
  for (const it of items) {
    if (it.assetId) ids.add(it.assetId);
  }
  return ids;
}

export function isGcCandidate(
  storageId: string,
  createdAt: string,
  referenced: Set<string>,
  now = Date.now(),
  ttlMs = ASSET_TTL_MS,
): boolean {
  if (referenced.has(storageId)) return false;
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return now - t >= ttlMs;
}

export async function encodeWebp(
  source: Blob | ImageBitmap,
  max = MAX_EDGE,
): Promise<{ blob: Blob; w: number; h: number }> {
  const bitmap =
    source instanceof ImageBitmap
      ? source
      : await createImageBitmap(source);
  try {
    const size = fitWithin(bitmap.width, bitmap.height, max);
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not encode image.');
    ctx.drawImage(bitmap, 0, 0, size.w, size.h);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Could not encode image.'))),
        'image/webp',
        0.86,
      );
    });
    return { blob, w: size.w, h: size.h };
  } finally {
    bitmap.close();
  }
}
