import { notFound } from "next/navigation";
import { MovieDetailResolver } from "@/components/movie/movie-detail-resolver";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

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

  // Cloud mode: resolve movie from byCollection on the client.
  // Local/offline: seed collection metadata only (no mock-data movie lookup).
  const seedCollection = isSupabaseConfigured()
    ? null
    : (collectionService.getById(collectionId) ?? null);

  return (
    <PageShell wide top>
      <MovieDetailResolver
        collectionId={collectionId}
        seedCollection={seedCollection}
        movieId={movieId ?? ""}
        initialItem={null}
      />
    </PageShell>
  );
}
