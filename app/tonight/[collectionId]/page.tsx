import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { TonightSessionClient } from "@/components/tonight/tonight-session-client";
import { getPartnerVotesForCollection } from "@/lib/mock-partner-votes";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";

type TonightPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function TonightPage({ params }: TonightPageProps) {
  const { collectionId } = await params;
  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  const items = movieService.getCollectionMovies(collection.items);
  const movies = items.map((item) => item.movie);
  const partnerVotes = getPartnerVotesForCollection(collectionId);

  return (
    <PageShell top>
      <TonightSessionClient
        collectionId={collection.id}
        collectionName={collection.name}
        movies={movies}
        partnerVotes={partnerVotes}
      />
    </PageShell>
  );
}
