import { CollectionsClient } from "@/components/collections/collections-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function CollectionsPage() {
  const collections = isSupabaseConfigured()
    ? []
    : collectionService.getAll();

  return (
    <PageShell>
      <CollectionsClient collections={collections} />
    </PageShell>
  );
}
