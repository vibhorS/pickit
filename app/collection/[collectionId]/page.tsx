import { notFound } from "next/navigation";
import { CollectionDetailClient } from "@/components/collections/collection-detail-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

type CollectionPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { collectionId } = await params;
  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  const initialItems = movieService.getCollectionMovies(collection.items);

  return (
    <PageShell wide top>
      <CollectionDetailClient
        collection={collection}
        initialItems={initialItems}
      />
    </PageShell>
  );
}
