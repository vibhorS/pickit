"use client";

import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FadeIn } from "@/components/ui/fade-in";
import { MOTION } from "@/lib/motion";

export function HomeClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [enteringPickMode, setEnteringPickMode] = useState(false);

  function enterPickMode() {
    if (enteringPickMode) return;
    setEnteringPickMode(true);
    const delay = reduceMotion ? 0 : 650;
    window.setTimeout(() => router.push("/movie-night"), delay);
  }

  return (
    <motion.div
      animate={{
        scale: enteringPickMode && !reduceMotion ? 0.975 : 1,
      }}
      transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
      className="mx-auto flex min-h-[min(72vh,880px)] w-full max-w-4xl flex-col justify-center px-1 pb-16"
    >
      <FadeIn className="relative py-8 sm:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-netflix-red/10 blur-3xl"
        />
        <div className="relative max-w-3xl">
          <p className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl">
            PickIt<span className="text-netflix-red">.</span>
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.02] tracking-[-0.045em] text-white sm:mt-8 sm:text-6xl lg:text-7xl">
            Stop scrolling.
            <br />
            Start watching.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-netflix-muted sm:text-lg">
            Two people, one movie, less time deciding.
          </p>

          <button
            type="button"
            onClick={enterPickMode}
            disabled={enteringPickMode}
            className="btn-primary mt-10 inline-flex min-h-14 w-full items-center justify-center gap-2 px-7 text-base shadow-[var(--shadow-elevated)] sm:w-auto"
          >
            <span aria-hidden="true">🍿</span>
            Pick a Movie
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>

          <div className="mt-12">
            <Link
              href="/capture"
              prefetch
              className="group inline-flex min-h-11 items-center gap-3 text-sm font-medium text-netflix-muted transition hover:text-white"
            >
              <span
                aria-hidden="true"
                className="grid size-11 place-items-center rounded-full bg-white/[0.05] text-netflix-red transition group-hover:bg-white/[0.09]"
              >
                <Plus className="size-4" />
              </span>
              Add Recommendation
              <ArrowRight
                className="size-4 text-white/20 transition group-hover:translate-x-0.5 group-hover:text-white/60"
                aria-hidden="true"
              />
            </Link>
          </div>
        </div>
      </FadeIn>

      <AnimatePresence>
        {enteringPickMode && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-md"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.45 }}
          >
            <div className="text-center">
              <p
                className={`text-5xl ${reduceMotion ? "" : "animate-bounce"}`}
                aria-hidden="true"
              >
                🍿
              </p>
              <p className="mt-5 text-sm font-semibold uppercase tracking-[0.24em] text-white/70">
                Entering Pick Mode
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
