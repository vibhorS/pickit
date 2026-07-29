"use client";

import Link from "next/link";
import { ArrowRight, Camera, Popcorn } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FadeIn } from "@/components/ui/fade-in";
import { resolveCollectionCatalog } from "@/lib/collections/resolve-catalog";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { MOTION } from "@/lib/motion";
import { analytics } from "@/lib/observability/analytics";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useCollectionStatsList } from "@/store/collection-stats-selector";

export function HomeClient() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [enteringPickMode, setEnteringPickMode] = useState(false);
  const seedCollections = isSupabaseConfigured()
    ? []
    : collectionService.getAll();
  const createdCollections = useLocalCollectionStore(
    (state) => state.createdCollections,
  );
  const collectionOverrides = useLocalCollectionStore(
    (state) => state.collectionOverrides,
  );
  const memberships = useCollaborationStore((state) => state.memberships);
  const activeUserId = useCollaborationStore((state) => state.activeUserId);

  const collections = useMemo(() => {
    const merged = resolveCollectionCatalog(
      seedCollections,
      createdCollections,
      collectionOverrides,
    );
    return merged.filter((collection) => {
      const collectionMemberships = memberships.filter(
        (membership) => membership.collectionId === collection.id,
      );
      return (
        collectionMemberships.length === 0 ||
        collectionMemberships.some(
          (membership) => membership.userId === activeUserId,
        )
      );
    });
  }, [
    activeUserId,
    collectionOverrides,
    createdCollections,
    memberships,
    seedCollections,
  ]);

  const recentCollections = useMemo(
    () => collections.slice(0, 3),
    [collections],
  );
  const stats = useCollectionStatsList(
    recentCollections.map((entry) => entry.id),
  );

  function enterPickMode() {
    if (enteringPickMode) return;
    analytics.track("movie_night_started", { entry: "home_cta" });
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
      className="mx-auto flex min-h-[75vh] w-full max-w-xl flex-col px-1 pb-8"
    >
      <FadeIn className="relative py-4">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-16 size-56 rounded-full bg-netflix-red/10 blur-3xl"
        />
        <div className="relative">
          <p className="text-3xl font-bold tracking-[-0.04em] text-white">
            PickIt<span className="text-netflix-red">.</span>
          </p>
          <h1 className="mt-6 text-4xl font-bold leading-[1.02] tracking-[-0.04em] text-white">
            What should we watch tonight?
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-netflix-muted">
            Pick faster, scroll less.
          </p>

          <button
            type="button"
            onClick={enterPickMode}
            disabled={enteringPickMode}
            className="btn-primary mt-8 inline-flex min-h-14 w-full items-center justify-center gap-2 px-7 text-base shadow-[var(--shadow-elevated)]"
          >
            <Popcorn className="size-5" aria-hidden="true" />
            Pick Tonight&apos;s Movie
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>

          <div className="mt-4">
            <Link
              href="/capture"
              prefetch
              className="group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm font-medium text-white/90 transition hover:bg-white/[0.06]"
            >
              <Camera className="size-4 text-netflix-red" aria-hidden="true" />
              Capture Recommendation
            </Link>
          </div>

          <section className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
              Recent Collections
            </p>
            <div className="mt-3 space-y-3">
              {recentCollections.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm text-netflix-muted">
                  No collections yet. Capture a screenshot to start your first
                  one.
                </p>
              ) : (
                recentCollections.map((collection, index) => {
                  const stat = stats[index];
                  const movieCount = stat?.totalMovies ?? 0;
                  return (
                    <Link
                      key={collection.id}
                      href={`/collection/${collection.id}`}
                      className="block rounded-2xl border border-white/10 bg-netflix-surface p-4 transition hover:bg-white/[0.05]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xl" aria-hidden="true">
                          {collection.emoji}
                        </span>
                        <p className="truncate text-base font-semibold text-white">
                          {collection.name}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-netflix-muted">
                        {movieCount} movies · {stat?.mutualMatches ?? 0} mutual
                        matches
                      </p>
                      <div className="mt-3 h-2 rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-netflix-red"
                          style={{
                            width: `${Math.max(8, stat?.completionPercent ?? 0)}%`,
                          }}
                        />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </section>
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
