"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { MOTION } from "@/lib/motion";

type CaptureSaveSuccessProps = {
  savedMovieCount: number;
  primaryCollectionId: string | null;
  onCaptureAnother: () => void;
};

export function CaptureSaveSuccess({
  savedMovieCount,
  primaryCollectionId,
  onCaptureAnother,
}: CaptureSaveSuccessProps) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.75 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
        className="flex size-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300"
      >
        <Check className="size-8" strokeWidth={2.5} />
      </motion.div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
        Saved {savedMovieCount} {savedMovieCount === 1 ? "movie" : "movies"}
      </h1>
      <p className="mt-2 text-sm text-netflix-muted">
        Source, original content, timestamp, and lists are saved with
        this capture.
      </p>

      <div className="mt-9 flex w-full flex-col gap-2.5">
        <button
          type="button"
          onClick={onCaptureAnother}
          className="btn-primary w-full"
        >
          Capture Another
        </button>
        {primaryCollectionId && (
          <Link
            href={`/collection/${primaryCollectionId}`}
            prefetch
            className="btn-secondary w-full"
          >
            Go to List
          </Link>
        )}
        <Link href="/" prefetch className="btn-ghost w-full">
          Return Home
        </Link>
      </div>
    </div>
  );
}
