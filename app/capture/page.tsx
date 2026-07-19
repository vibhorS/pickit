import { CapturePipelineClient } from "@/components/capture/pipeline/capture-pipeline-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";

export default function CapturePage() {
  const seedCollections = collectionService.getAll();

  return (
    <PageShell wide top>
      <CapturePipelineClient seedCollections={seedCollections} />
    </PageShell>
  );
}
