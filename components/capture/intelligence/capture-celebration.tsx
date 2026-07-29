"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { MOTION } from "@/lib/motion";

type CaptureCelebrationProps = {
  count: number;
  onUndo: () => void;
  onDone: () => void;
};

export function CaptureCelebration({
  count,
  onUndo,
  onDone,
}: CaptureCelebrationProps) {
  return (
    <motion.div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 px-4 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.35, ease: MOTION.ease }}
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/12 bg-netflix-surface px-6 py-10 text-center shadow-[var(--shadow-elevated)]"
      >
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(229,9,20,0.28),transparent_60%)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        />
        <motion.div
          className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 text-3xl"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          ✨
        </motion.div>
        <h2 className="relative mt-6 text-2xl font-bold tracking-tight text-white sm:text-3xl">
          {count} new recommendation{count === 1 ? "" : "s"} saved.
        </h2>
        <p className="relative mt-3 text-sm text-netflix-muted">
          They’re in your collections — ready for movie night.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={onDone}>
            Keep browsing
          </Button>
          <Button type="button" variant="secondary" onClick={onUndo}>
            Undo
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
