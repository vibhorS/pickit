import { CaptureIntelligenceClient } from "@/components/capture/intelligence/capture-intelligence-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";

export default function CapturePage() {
  const seedCollections = collectionService.getAll();

  return (
    <PageShell wide top>
      <CaptureIntelligenceClient seedCollections={seedCollections} />
    </PageShell>
  );
}
