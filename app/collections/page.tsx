import { CollectionCard } from "@/components/collections/collection-card";
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/ui/empty-state";
import { collectionService } from "@/lib/services/collection-service";

export default function CollectionsPage() {
  const collections = collectionService.getAll();

  return (
    <PageShell>
      <div className="mx-auto w-full max-w-md">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-netflix-red">
            Library
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">
            Your Collections
          </h1>
        </div>

        <div className="mt-10 flex flex-col gap-4">
          {collections.length === 0 ? (
            <EmptyState
              emoji="📚"
              title="No collections yet"
              description="Create your first collection to start saving movies together."
            />
          ) : (
            collections.map((collection) => (
              <CollectionCard key={collection.id} collection={collection} />
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        className="fixed bottom-6 right-6 z-10 rounded-full bg-netflix-red px-5 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:bg-netflix-red-hover sm:bottom-8 sm:right-8"
      >
        + New Collection
      </button>
    </PageShell>
  );
}
