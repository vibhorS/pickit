"use client";

import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from "framer-motion";
import { useState, type ReactNode } from "react";
import type { VoteValue } from "@/lib/types";

const SWIPE_THRESHOLD = 120;

type SwipeableVoteShellProps = {
  onVote: (vote: VoteValue) => void;
  children: ReactNode;
  footer: (vote: (value: VoteValue) => void) => ReactNode;
};

export function SwipeableVoteShell({
  onVote,
  children,
  footer,
}: SwipeableVoteShellProps) {
  const [locked, setLocked] = useState(false);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-240, 0, 240], [-11, 0, 11]);
  const likeTint = useTransform(x, [0, SWIPE_THRESHOLD], [0, 0.2]);
  const passTint = useTransform(x, [-SWIPE_THRESHOLD, 0], [0.2, 0]);
  const likeLabel = useTransform(x, [36, SWIPE_THRESHOLD], [0, 1]);
  const passLabel = useTransform(x, [-SWIPE_THRESHOLD, -36], [1, 0]);

  async function commit(vote: VoteValue) {
    if (locked) return;
    setLocked(true);

    const exitX =
      vote === "like"
        ? Math.max(window.innerWidth * 1.1, 480)
        : -Math.max(window.innerWidth * 1.1, 480);

    await animate(x, exitX, { duration: 0.28, ease: "easeIn" });
    onVote(vote);
  }

  function handleDragEnd(
    _: unknown,
    info: { offset: { x: number }; velocity: { x: number } },
  ) {
    if (locked) return;

    const shouldLike =
      info.offset.x > SWIPE_THRESHOLD || info.velocity.x > 850;
    const shouldPass =
      info.offset.x < -SWIPE_THRESHOLD || info.velocity.x < -850;

    if (shouldLike) {
      void commit("like");
      return;
    }

    if (shouldPass) {
      void commit("pass");
      return;
    }

    void animate(x, 0, { type: "spring", stiffness: 420, damping: 34 });
  }

  return (
    <motion.div
      style={{ x, rotate }}
      drag={locked ? false : "x"}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.82}
      onDragEnd={handleDragEnd}
      className="relative mx-auto w-full touch-pan-y rounded-2xl border border-white/5 bg-netflix-surface shadow-[0_8px_30px_rgba(0,0,0,0.45)] will-change-transform"
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-emerald-500/80"
        style={{ opacity: likeTint }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-rose-500/70"
        style={{ opacity: passTint }}
      />

      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 top-4 z-20 rounded-full border border-emerald-200/30 bg-black/35 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-emerald-100 backdrop-blur-sm"
        style={{ opacity: likeLabel }}
      >
        I&apos;d Watch
      </motion.span>
      <motion.span
        aria-hidden="true"
        className="pointer-events-none absolute right-4 top-4 z-20 rounded-full border border-rose-200/25 bg-black/35 px-3 py-1 text-[0.6875rem] font-semibold uppercase tracking-wide text-rose-100 backdrop-blur-sm"
        style={{ opacity: passLabel }}
      >
        Not for Me
      </motion.span>

      <div className="relative z-0">{children}</div>
      <div className="relative z-20">{footer(commit)}</div>
    </motion.div>
  );
}
