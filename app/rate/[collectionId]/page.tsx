import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { RateSession } from "@/components/rate/rate-session";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

type RatePageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function RatePage({ params }: RatePageProps) {
  const { collectionId } = await params;

  if (!collectionId) {
    notFound();
  }

  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  const items = movieService.getCollectionMovies(collection.items);

  return (
    <PageShell top>
      <RateSession collection={collection} items={items} />
    </PageShell>
  );
}
