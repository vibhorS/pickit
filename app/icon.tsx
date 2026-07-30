import { createPickItIconResponse } from "@/lib/brand/pickit-icon";

export const contentType = "image/png";

const SIZES = {
  "32": 32,
  "48": 48,
  "192": 192,
  "512": 512,
} as const;

type IconId = keyof typeof SIZES;

export function generateImageMetadata() {
  return (Object.keys(SIZES) as IconId[]).map((id) => ({
    id,
    contentType,
    size: { width: SIZES[id], height: SIZES[id] },
  }));
}

export default async function Icon({
  id,
}: {
  id: Promise<string | number>;
}) {
  const resolved = String(await id) as IconId;
  const size = SIZES[resolved] ?? SIZES["32"];
  const padded = size >= 192;
  return createPickItIconResponse(size, { padded });
}
