import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { RateSessionResolver } from "@/components/rate/rate-session-resolver";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type RatePageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function RatePage({ params }: RatePageProps) {
  const { collectionId } = await params;

  if (!collectionId) {
    notFound();
  }

  // Cloud mode: movie rows come from byCollection (hydrated read model).
  // Local/offline: seed collection metadata only; RateSession still merges byCollection.
  const seedCollection = isSupabaseConfigured()
    ? null
    : (collectionService.getById(collectionId) ?? null);

  return (
    <PageShell top>
      <RateSessionResolver
        collectionId={collectionId}
        seedCollection={seedCollection}
        seedItems={[]}
      />
    </PageShell>
  );
}
