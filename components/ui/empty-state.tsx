"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { MOTION } from "@/lib/motion";

type EmptyStateProps = {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  actionHref?: {
    label: string;
    href: string;
  };
};

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.duration, ease: MOTION.ease }}
      className="px-4 py-14 text-center sm:px-8 sm:py-16"
    >
      <div
        aria-hidden="true"
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-netflix-muted"
      >
        {icon ?? (
          <span className="text-3xl opacity-90">{emoji ?? "✨"}</span>
        )}
      </div>
      <h3 className="mt-6 text-xl font-semibold tracking-tight text-white sm:text-2xl">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-netflix-muted sm:text-[0.9375rem]">
        {description}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="btn-primary mt-8 min-h-11 px-7"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}

type ToastProps = {
  message: string | null;
};

export function Toast({ message }: ToastProps) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: MOTION.duration, ease: MOTION.ease }}
          className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-netflix-surface/95 px-5 py-3 text-sm font-medium text-white shadow-[0_8px_30px_rgba(0,0,0,0.45)] backdrop-blur-sm"
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
