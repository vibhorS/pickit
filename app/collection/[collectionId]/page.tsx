import { notFound } from "next/navigation";
import { CollectionPageClient } from "@/components/collections/collection-page-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

type CollectionPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { collectionId } = await params;

  if (!collectionId) {
    notFound();
  }

  const seedCollection = isSupabaseConfigured()
    ? null
    : (collectionService.getById(collectionId) ?? null);

  return (
    <PageShell wide top>
      <CollectionPageClient
        collectionId={collectionId}
        seedCollection={seedCollection}
      />
    </PageShell>
  );
}
