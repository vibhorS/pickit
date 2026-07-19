import { notFound } from "next/navigation";
import { MovieDetailResolver } from "@/components/movie/movie-detail-resolver";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

type MovieDetailPageProps = {
  params: Promise<{ collectionId: string; movieId: string }>;
};

export default async function MovieDetailPage({
  params,
}: MovieDetailPageProps) {
  const { collectionId, movieId } = await params;

  if (!collectionId) {
    notFound();
  }

  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  // Server mock may not include TMDb-added titles — client store resolves those.
  const initialItem =
    movieId && collection.items.length > 0
      ? (movieService.getCollectionMovie(collection.items, movieId) ?? null)
      : null;

  return (
    <PageShell wide top>
      <MovieDetailResolver
        collection={collection}
        movieId={movieId ?? ""}
        initialItem={initialItem}
      />
    </PageShell>
  );
}
