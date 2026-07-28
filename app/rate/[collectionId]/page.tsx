import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { RateSessionResolver } from "@/components/rate/rate-session-resolver";
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

  const items = collection
    ? movieService.getCollectionMovies(collection.items)
    : [];

  return (
    <PageShell top>
      <RateSessionResolver
        collectionId={collectionId}
        seedCollection={collection ?? null}
        seedItems={items}
      />
    </PageShell>
  );
}
