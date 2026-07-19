import type {
  CaptureAdapter,
  CapturePayload,
  ManualCaptureInput,
} from "@/lib/capture/types";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ManualPasteAdapter
  implements CaptureAdapter<ManualCaptureInput>
{
  readonly id = "manual-paste";

  async receive(input: ManualCaptureInput): Promise<CapturePayload> {
    const content = input.content.trim();
    if (!content) {
      throw new Error("Paste a link, text, or movie list to continue.");
    }

    return {
      id: createId("payload"),
      adapterId: this.id,
      kind: input.kind,
      content,
      receivedAt: new Date().toISOString(),
    };
  }
}

abstract class FutureCaptureAdapter implements CaptureAdapter<unknown> {
  abstract readonly id: string;

  async receive(): Promise<CapturePayload> {
    // TODO: Translate the platform share payload into CapturePayload.
    throw new Error(`${this.id} is not available yet.`);
  }
}

export class ClipboardAdapter extends FutureCaptureAdapter {
  readonly id = "clipboard";
}

export class NativeShareAdapter extends FutureCaptureAdapter {
  readonly id = "native-share";
}

export class WebShareAdapter extends FutureCaptureAdapter {
  readonly id = "web-share";
}
