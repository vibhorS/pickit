/**
 * Client-side screenshot compression before upload / persistence.
 * Keeps Capture under ~10s by shrinking payload size.
 */

export type CompressImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/jpeg" | "image/webp";
};

const DEFAULTS: Required<CompressImageOptions> = {
  maxWidth: 1600,
  maxHeight: 2200,
  quality: 0.78,
  mimeType: "image/jpeg",
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read image."));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read file."));
    };
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

export async function compressImageDataUrl(
  dataUrl: string,
  options: CompressImageOptions = {},
): Promise<{ full: string; thumbnail: string }> {
  const opts = { ...DEFAULTS, ...options };
  const img = await loadImage(dataUrl);
  const scale = Math.min(
    1,
    opts.maxWidth / img.width,
    opts.maxHeight / img.height,
  );
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable.");
  ctx.drawImage(img, 0, 0, width, height);

  const full = canvas.toDataURL(opts.mimeType, opts.quality);

  const thumbScale = Math.min(1, 320 / width, 420 / height);
  const thumbW = Math.max(1, Math.round(width * thumbScale));
  const thumbH = Math.max(1, Math.round(height * thumbScale));
  const thumb = document.createElement("canvas");
  thumb.width = thumbW;
  thumb.height = thumbH;
  const tctx = thumb.getContext("2d");
  if (!tctx) throw new Error("Canvas unavailable.");
  tctx.drawImage(canvas, 0, 0, thumbW, thumbH);
  const thumbnail = thumb.toDataURL("image/jpeg", 0.7);

  return { full, thumbnail };
}

export async function compressImageFile(
  file: File,
  options?: CompressImageOptions,
): Promise<{ full: string; thumbnail: string }> {
  const raw = await fileToDataUrl(file);
  return compressImageDataUrl(raw, options);
}
