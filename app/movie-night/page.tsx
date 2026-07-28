import { MovieNightFlow } from "@/components/movie-night/movie-night-flow";
import { PageShell } from "@/components/page-shell";
import type { MovieNightCollectionCard } from "@/lib/movie-night-types";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

export default function MovieNightPage() {
  const collections = collectionService.getAll();

  const cards: MovieNightCollectionCard[] = collections.map((collection) => {
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
