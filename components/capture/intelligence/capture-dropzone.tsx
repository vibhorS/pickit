"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  ClipboardPaste,
  ImagePlus,
  Link2,
  MessageCircle,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import { Button } from "@/components/ui/button";
import {
  compressImageDataUrl,
  compressImageFile,
  fileToDataUrl,
} from "@/lib/capture/intelligence/compress-image";
import { MOTION } from "@/lib/motion";

export type CaptureDropPayload = {
  imageDataUrl?: string;
  thumbnailDataUrl?: string;
};

type CaptureDropzoneProps = {
  disabled?: boolean;
  onCapture: (payload: CaptureDropPayload) => void;
};

export function CaptureDropzone({ disabled, onCapture }: CaptureDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleImage = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setLocalError("Try a screenshot image.");
        return;
      }
      setBusy(true);
      setLocalError(null);
      try {
        const compressed = await compressImageFile(file);
        onCapture({
          imageDataUrl: compressed.full,
          thumbnailDataUrl: compressed.thumbnail,
        });
      } catch (error) {
        setLocalError(
          error instanceof Error ? error.message : "Could not read that image.",
        );
      } finally {
        setBusy(false);
      }
    },
    [onCapture],
  );

  const handlePasteImage = useCallback(
    async (blob: Blob) => {
      setBusy(true);
      setLocalError(null);
      try {
        const raw = await fileToDataUrl(blob);
        const compressed = await compressImageDataUrl(raw);
        onCapture({
          imageDataUrl: compressed.full,
          thumbnailDataUrl: compressed.thumbnail,
        });
      } catch (error) {
        setLocalError(
          error instanceof Error ? error.message : "Clipboard paste failed.",
        );
      } finally {
        setBusy(false);
      }
    },
    [onCapture],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      if (disabled || busy) return;
      const items = event.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const blob = item.getAsFile();
          if (blob) void handlePasteImage(blob);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, disabled, handlePasteImage]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || busy) return;
    const file = event.dataTransfer.files?.[0];
    if (file) void handleImage(file);
  };

  return (
    <div className="w-full">
      <motion.div
        onDragEnter={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        animate={{
          scale: dragging ? 1.015 : 1,
          borderColor: dragging
            ? "rgba(229, 9, 20, 0.6)"
            : "rgba(255,255,255,0.14)",
        }}
        transition={{ duration: MOTION.duration, ease: MOTION.ease }}
        className={`relative overflow-hidden rounded-[1.85rem] border border-dashed bg-gradient-to-b from-white/[0.07] via-white/[0.02] to-transparent px-6 py-14 text-center sm:px-10 sm:py-[4.25rem] ${
          disabled || busy ? "pointer-events-none opacity-60" : ""
        }`}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.16),transparent_55%)]"
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -left-10 top-10 h-40 w-40 rounded-full bg-netflix-red/10 blur-3xl"
          animate={{ opacity: dragging ? 0.9 : 0.45, scale: dragging ? 1.15 : 1 }}
          transition={{ duration: 0.35 }}
        />
        <div className="relative">
          <motion.div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-[var(--shadow-card)]"
            animate={{ y: dragging ? -4 : 0 }}
            transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          >
            <ImagePlus className="h-7 w-7 text-netflix-red" strokeWidth={1.75} />
          </motion.div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Upload Screenshot
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-netflix-muted">
            Screenshot Instagram, Reddit, YouTube — or paste from your
            clipboard. PickIt does the thinking.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" />
              Upload screenshot
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={disabled || busy}
              onClick={async () => {
                try {
                  const items = await navigator.clipboard.read();
                  for (const item of items) {
                    const type = item.types.find((t) => t.startsWith("image/"));
                    if (type) {
                      const blob = await item.getType(type);
                      await handlePasteImage(blob);
                      return;
                    }
                  }
                  setLocalError(
                    "No image on the clipboard — copy a screenshot, then press Ctrl+V.",
                  );
                } catch {
                  setLocalError("Allow clipboard access, or just press Ctrl+V.");
                }
              }}
            >
              <ClipboardPaste className="mr-2 h-4 w-4" />
              Paste image
            </Button>
          </div>

          <p className="mt-5 text-xs text-netflix-muted/85">
            Tip: copy a screenshot → open Capture → Ctrl+V
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImage(file);
            e.target.value = "";
          }}
        />
      </motion.div>

      {localError ? (
        <p className="mt-3 text-sm text-amber-200" role="alert">
          {localError}
        </p>
      ) : null}
    </div>
  );
}

/** Premium empty inbox encouragement. */
export function CaptureInboxEmpty({
  onFocusUpload,
}: {
  onFocusUpload?: () => void;
}) {
  const examples = [
    { icon: Sparkles, label: "Instagram list" },
    { icon: MessageCircle, label: "WhatsApp recommendation" },
    { icon: Link2, label: "Reddit / Letterboxd thread" },
    { icon: Sparkles, label: "Netflix / YouTube screenshot" },
  ];

  return (
    <div className="relative mt-8 overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-white/[0.05] via-transparent to-netflix-red/[0.07] px-6 py-12 text-center sm:px-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(229,9,20,0.12),transparent_55%)]"
      />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-netflix-red">
          Try it
        </p>
        <h3 className="mt-3 text-2xl font-bold tracking-tight text-white">
          Your recommendation inbox is empty.
        </h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-netflix-muted">
          Paste a screenshot from anywhere — a listicle, a friend&apos;s tip, a
          late-night scroll. Watch PickIt understand it.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {examples.map((example) => {
            const Icon = example.icon;
            return (
              <span
                key={example.label}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-netflix-muted"
              >
                <Icon className="h-3.5 w-3.5" />
                {example.label}
              </span>
            );
          })}
        </div>
        {onFocusUpload ? (
          <Button type="button" className="mt-8" onClick={onFocusUpload}>
            Paste a screenshot
          </Button>
        ) : null}
      </div>
    </div>
  );
}
