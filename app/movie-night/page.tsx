import { MovieNightFlow } from "@/components/movie-night/movie-night-flow";
import { PageShell } from "@/components/page-shell";
import type { MovieNightCollectionCard } from "@/lib/movie-night-types";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function MovieNightPage() {
  // Cloud mode: client resolves lists + movies from the hydrated read model.
  // Local/offline only: seed cards from mock collections for demo UX.
  const cards: MovieNightCollectionCard[] = isSupabaseConfigured()
    ? []
    : collectionService.getAll().map((collection) => {
        const items = movieService.getCollectionMovies(collection.items);
        return {
          collection,
          items,
          movieCount: items.length,
        };
      });

  return (
    <PageShell top wide>
      <MovieNightFlow cards={cards} />
    </PageShell>
  );
}
