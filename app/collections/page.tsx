import { CollectionsClient } from "@/components/collections/collections-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";

export default function CollectionsPage() {
  const collections = collectionService.getAll();

  return (
    <PageShell>
      <CollectionsClient collections={collections} />
    </PageShell>
  );
}
