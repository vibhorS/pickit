import { CaptureIntelligenceClient } from "@/components/capture/intelligence/capture-intelligence-client";
import { PageShell } from "@/components/page-shell";
import { collectionService } from "@/lib/services/collection-service";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export default function CapturePage() {
  const seedCollections = isSupabaseConfigured()
    ? []
    : collectionService.getAll();

  return (
    <PageShell wide top>
      <CaptureIntelligenceClient seedCollections={seedCollections} />
    </PageShell>
  );
}
