/**
 * Perceptual image hashing (average hash) used to actually verify Rise photo
 * missions instead of trusting the user's self-attestation.
 *
 * aHash: downscale to 8x8 grayscale, compare each pixel to the mean, pack the
 * result into a 64-bit fingerprint. Robust to lighting/scale/compression
 * changes but sensitive to composition — exactly what "is this the same spot?"
 * needs.
 */

const HASH_SIZE = 8;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

/** Returns a 64-length bit array, or null when the image can't be processed. */
export async function averageHash(src: string): Promise<Uint8Array | null> {
  try {
    const img = await loadImage(src);
    const canvas = document.createElement('canvas');
    canvas.width = HASH_SIZE;
    canvas.height = HASH_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, HASH_SIZE, HASH_SIZE);
    const { data } = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE);

    const gray = new Float32Array(HASH_SIZE * HASH_SIZE);
    let sum = 0;
    for (let i = 0; i < gray.length; i++) {
      const o = i * 4;
      // Rec. 601 luma
      const g = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
      gray[i] = g;
      sum += g;
    }
    const mean = sum / gray.length;

    const bits = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) bits[i] = gray[i] >= mean ? 1 : 0;
    return bits;
  } catch {
    return null;
  }
}

/** Number of differing bits between two hashes (0 = identical, 64 = inverse). */
export function hammingDistance(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  let d = 0;
  for (let i = 0; i < len; i++) if (a[i] !== b[i]) d++;
  return d;
}

/** Max differing bits still considered "the same place". Tuned for phone cameras. */
export const PHOTO_MATCH_THRESHOLD = 16;

export type PhotoCheck =
  | { result: 'match'; distance: number }
  | { result: 'mismatch'; distance: number }
  | { result: 'unavailable' };

/**
 * Compare a freshly captured photo against the registered reference photo.
 * Returns 'unavailable' when hashing isn't possible (no canvas, broken image),
 * so callers can fall back to manual confirmation rather than trapping the user
 * inside a ringing alarm.
 */
export async function comparePhotos(referenceSrc: string, capturedSrc: string): Promise<PhotoCheck> {
  const [ref, shot] = await Promise.all([averageHash(referenceSrc), averageHash(capturedSrc)]);
  if (!ref || !shot) return { result: 'unavailable' };
  const distance = hammingDistance(ref, shot);
  return distance <= PHOTO_MATCH_THRESHOLD
    ? { result: 'match', distance }
    : { result: 'mismatch', distance };
}
