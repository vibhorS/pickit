/**
 * Future-ready capture source adapters.
 * Instagram Share / Reddit / WhatsApp / extension should plug in here.
 * The processing pipeline (vision → match → review → import) stays identical.
 */

import type { CaptureMediaKind } from "@/lib/capture/intelligence/types";

export type IncomingCapture = {
  mediaKind: CaptureMediaKind;
  imageDataUrl?: string | null;
  textContent?: string | null;
  sourceUrl?: string | null;
  adapterId: string;
};

export interface CaptureSourceAdapter<TInput = unknown> {
  readonly id: string;
  readonly label: string;
  canHandle(input: TInput): boolean;
  receive(input: TInput): Promise<IncomingCapture>;
}

/** Clipboard / drop / file picker — Phase 2C primary adapter. */
export const manualMediaAdapter: CaptureSourceAdapter<{
  imageDataUrl?: string;
  text?: string;
  sourceUrl?: string;
}> = {
  id: "manual-media",
  label: "Manual",
  canHandle(input) {
    return Boolean(input.imageDataUrl || input.text || input.sourceUrl);
  },
  async receive(input) {
    const mediaKind: CaptureMediaKind = input.imageDataUrl
      ? "screenshot"
      : input.sourceUrl
        ? "url"
        : "text";
    return {
      mediaKind,
      imageDataUrl: input.imageDataUrl ?? null,
      textContent: input.text ?? null,
      sourceUrl: input.sourceUrl ?? null,
      adapterId: this.id,
    };
  },
};

/** Placeholders for future share targets — implement receive() later. */
export const FUTURE_ADAPTER_IDS = [
  "instagram-share",
  "youtube-share",
  "reddit-share",
  "tiktok-share",
  "whatsapp-share",
  "clipboard-monitor",
  "browser-extension",
  "email-forward",
] as const;
