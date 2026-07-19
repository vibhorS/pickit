"use client";

import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useState, type ReactNode } from "react";

const SWIPE_THRESHOLD = 120;

export type ChoiceDirection = "accept" | "skip";

type SwipeableChoiceShellProps = {
  onChoice: (direction: ChoiceDirection) => void;
  acceptLabel?: string;
  skipLabel?: string;
  children: ReactNode;
  footer: (choose: (direction: ChoiceDirection) => void) => ReactNode;
};

/**
 * Shared swipe shell for Decision Mode.
 * Right / accept → choose. Left / skip → next.
 */
export function SwipeableChoiceShell({
  onChoice,
  acceptLabel = "Choose",
  skipLabel = "Skip",
  children,
  footer,
}: SwipeableChoiceShellProps) {
  const [locked, setLocked] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-11, 0, 11]);
  const acceptTint = useTransform(x, [0, SWIPE_THRESHOLD], [0, 0.18]);
  const skipTint = useTransform(x, [-SWIPE_THRESHOLD, 0], [0.14, 0]);
  const acceptOpacity = useTransform(x, [36, SWIPE_THRESHOLD], [0, 1]);
  const skipOpacity = useTransform(x, [-SWIPE_THRESHOLD, -36], [1, 0]);

  async function commit(direction: ChoiceDirection) {
    if (locked) return;
    setLocked(true);

    const exitX =
      direction === "accept"
        ? Math.max(window.innerWidth * 1.1, 480)
        : -Math.max(window.innerWidth * 1.1, 480);

    await animate(x, exitX, { duration: 0.22, ease: [0.25, 0.1, 0.25, 1] });
    onChoice(direction);
  }

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    if (locked) return;

    const shouldAccept =
      info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 850;
    const shouldSkip =
      info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -850;

    if (shouldAccept) {
      void commit("accept");
      return;
    }

    if (shouldSkip) {
      void commit("skip");
      return;
    }

    void animate(x, 0, { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] });
  }

  return (
    <motion.div
      style={{ x, rotate }}
      drag={locked ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.82}
      onDragEnd={handleDragEnd}
      className="relative mx-auto w-full touch-pan-y rounded-2xl bg-netflix-surface shadow-[var(--shadow-card)] will-change-transform"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-emerald-500/70"
        style={{ opacity: acceptTint }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-white/25"
        style={{ opacity: skipTint }}
      />

      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-full bg-black/40 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-emerald-100 backdrop-blur-sm"
        style={{ opacity: acceptOpacity }}
      >
        {acceptLabel}
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-full bg-black/40 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-white/85 backdrop-blur-sm"
        style={{ opacity: skipOpacity }}
      >
        {skipLabel}
      </motion.span>

      <div className="relative z-0">{children}</div>
      <div className="relative z-20">{footer(commit)}</div>
    </motion.div>
  );
}
