"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PartyPopper } from "lucide-react";
import { FadeIn } from "@/components/ui/fade-in";
import { MOTION } from "@/lib/motion";

type RateCompletionProps = {
  collectionId: string;
  collectionName: string;
};

export function RateCompletion({
  collectionId,
  collectionName,
}: RateCompletionProps) {
  return (
    <FadeIn>
      <section className="mx-auto flex w-full max-w-lg flex-col items-center px-4 py-14 text-center sm:py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: MOTION.durationSlow, ease: MOTION.ease }}
          aria-hidden="true"
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04] text-netflix-muted"
        >
          <PartyPopper className="size-7" strokeWidth={1.5} />
        </motion.div>
        <h2 className="mt-6 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          You&apos;re all caught up!
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-netflix-muted sm:text-base">
          You&apos;ve rated every movie in {collectionName}.
        </p>
        <Link
          href={`/collection/${collectionId}`}
          prefetch
          className="btn-primary mt-8"
        >
          Back to List
        </Link>
      </section>
    </FadeIn>
  );
}
