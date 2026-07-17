import { notFound } from "next/navigation";
import { DecisionMode } from "@/components/decision/decision-mode";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

type DecisionPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function DecisionPage({ params }: DecisionPageProps) {
  const { collectionId } = await params;
  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  const movies = movieService.getMoviesByIds(
    collectionService.getMovieIds(collection),
  );

  return (
    <PageShell wide top>
      <DecisionMode collection={collection} movies={movies} />
    </PageShell>
  );
}
