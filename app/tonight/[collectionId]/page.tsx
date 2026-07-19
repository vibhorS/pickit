import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { TonightSessionClient } from "@/components/tonight/tonight-session-client";
import { collectionService } from "@/lib/services/collection-service";

type TonightPageProps = {
  params: Promise<{ collectionId: string }>;
};

export default async function TonightPage({ params }: TonightPageProps) {
  const { collectionId } = await params;
  const collection = collectionService.getById(collectionId);

  if (!collection) {
    notFound();
  }

  return (
    <PageShell top>
      <TonightSessionClient
        collectionId={collection.id}
        collectionName={collection.name}
      />
    </PageShell>
  );
}
