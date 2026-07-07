// Client-side image compression + SHA-256 hashing for duplicate detection.

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DIMENSION = 2000;

export interface CompressedImage {
  file: File;
  hash: string; // hex sha-256 of the compressed bytes
}

export async function hashFile(file: File | Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = url;
    });
  } finally {
    // Revoked later after draw
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas encode failed"))),
      "image/jpeg",
      quality
    );
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  // If already small enough and JPEG/PNG, still re-encode to normalize hash.
  const img = await loadImage(file);
  let { width, height } = img;
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.9;
  let blob = await canvasToBlob(canvas, quality);
  while (blob.size > MAX_BYTES && quality > 0.4) {
    quality -= 0.1;
    blob = await canvasToBlob(canvas, quality);
  }
  // If still too large, downscale further.
  while (blob.size > MAX_BYTES && (canvas.width > 800 || canvas.height > 800)) {
    canvas.width = Math.round(canvas.width * 0.85);
    canvas.height = Math.round(canvas.height * 0.85);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, quality);
  }

  const hash = await hashFile(blob);
  const compressed = new File([blob], `${hash}.jpg`, { type: "image/jpeg" });
  return { file: compressed, hash };
}
