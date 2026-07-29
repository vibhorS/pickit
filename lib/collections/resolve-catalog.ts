import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { Collection } from "@/lib/types";
import {
  EMPTY_COLLECTION_OVERRIDES,
  EMPTY_CREATED_COLLECTIONS,
  mergeCollections,
  type CollectionOverride,
} from "@/store/local-collection-store";

/**
 * Production catalog when cloud is configured: createdCollections only
 * (hydrated from Supabase lists). Mock seed lists never enter the UI.
 *
 * Local / offline mode (no Supabase): seed mock collections remain available.
 */
export function resolveCollectionCatalog(
  seed: Collection[],
  created: Collection[] | undefined,
  overrides: Record<string, CollectionOverride> | undefined =
    EMPTY_COLLECTION_OVERRIDES,
): Collection[] {
  const createdSafe = created ?? EMPTY_CREATED_COLLECTIONS;
  const overridesSafe = overrides ?? EMPTY_COLLECTION_OVERRIDES;

  if (isSupabaseConfigured()) {
    return mergeCollections([], createdSafe, overridesSafe);
  }

  return mergeCollections(seed, createdSafe, overridesSafe);
}
