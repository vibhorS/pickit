import { notFound } from "next/navigation";
import { MovieDetailClient } from "@/components/movie/movie-detail-client";
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
  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  const item = movieService.getCollectionMovie(collection.items, movieId);

  if (!item) {
    notFound();
  }

  return (
    <PageShell wide top>
      <MovieDetailClient
        collection={collection}
        movie={item.movie}
        source={item.source}
      />
    </PageShell>
  );
}
