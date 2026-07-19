import { HomeClient } from "@/components/home/home-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";

export default function Home() {
  const seedCollections = collectionService.getAll();

  return (
    <PageShell top>
      <HomeClient seedCollections={seedCollections} />
    </PageShell>
  );
}
