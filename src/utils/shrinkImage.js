// Phone cameras take 3–12 MB photos, far bigger than anything Aura shows.
// This scales a photo down on the device before it's uploaded, so feeds and
// profiles load quickly for everyone. GIFs (which may be animated) and files
// that are already small pass through untouched, and if anything goes wrong
// the original file is used.

const SHRINKABLE = ['image/jpeg', 'image/png', 'image/webp'];

async function decode(file) {
  if (window.createImageBitmap) {
    try {
      // 'from-image' applies the photo's rotation, so portraits stay upright
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch { /* fall back to an <img> below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function hasTransparency(ctx, width, height) {
  // Sample a grid of pixels; enough to tell a logo from a photo
  const data = ctx.getImageData(0, 0, width, height).data;
  const step = Math.max(4, Math.floor(data.length / 4 / 4000)) * 4;
  for (let i = 3; i < data.length; i += step) if (data[i] < 250) return true;
  return false;
}

/**
 * @param {File} file
 * @param {{ maxEdge?: number, quality?: number, minBytes?: number }} options
 * @returns {Promise<File>} a smaller file, or the original
 */
export default async function shrinkImage(file, { maxEdge = 1600, quality = 0.85, minBytes = 300 * 1024 } = {}) {
  if (!file || !SHRINKABLE.includes(file.type)) return file;
  try {
    const image = await decode(file);
    const width  = image.width;
    const height = image.height;
    const scale  = Math.min(1, maxEdge / Math.max(width, height));
    // Already small enough in both senses: leave it alone
    if (scale === 1 && file.size <= minBytes) return file;

    const canvas = document.createElement('canvas');
    canvas.width  = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close?.();

    // Keep transparency for PNG/WebP images that use it; photos become JPEG
    const keepAlpha = file.type !== 'image/jpeg' && hasTransparency(ctx, canvas.width, canvas.height);
    const type = keepAlpha ? 'image/png' : 'image/jpeg';
    const blob = await new Promise(resolve => canvas.toBlob(resolve, type, quality));
    if (!blob || blob.size >= file.size) return file;

    const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${base}.${type === 'image/png' ? 'png' : 'jpg'}`, { type, lastModified: Date.now() });
  } catch {
    return file;
  }
}
