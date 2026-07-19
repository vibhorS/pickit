"use client";

import Link from "next/link";
import { Library } from "lucide-react";
import { HomeCaptureSections } from "@/components/home/home-capture-sections";
import { FadeIn } from "@/components/ui/fade-in";
import type { Collection } from "@/lib/types";

type HomeClientProps = {
  seedCollections: Collection[];
};

export function HomeClient({ seedCollections }: HomeClientProps) {
  return (
    <FadeIn className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-2 pb-24">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-netflix-red">
          Decision
        </p>
        <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          What are we watching?
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-netflix-muted sm:text-[0.9375rem]">
          Decide together in under two minutes.
        </p>
      </div>

      <div className="mt-14 flex flex-col gap-4">
        <Link
          href="/movie-night"
          prefetch
          className="btn-primary flex min-h-16 w-full items-center justify-center gap-2.5 text-lg shadow-[var(--shadow-elevated)]"
        >
          <span aria-hidden="true">🍿</span>
          Movie Night
        </Link>

        <Link
          href="/collections"
          prefetch
          className="btn-ghost flex min-h-11 w-full items-center justify-center gap-2 text-sm"
        >
          <Library className="size-4" strokeWidth={2} aria-hidden="true" />
          Collections
        </Link>

        <Link
          href="/capture"
          prefetch
          className="btn-secondary flex min-h-12 w-full items-center justify-center gap-2 text-sm"
        >
          <span aria-hidden="true">📥</span>
          Capture Recommendation
        </Link>
      </div>

      <HomeCaptureSections seedCollections={seedCollections} />
    </FadeIn>
  );
}
