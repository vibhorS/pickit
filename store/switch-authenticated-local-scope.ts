import { switchCaptureInboxScope } from "@/store/capture-inbox-store";
import { switchCaptureSessionsScope } from "@/store/capture-store";
import { switchLocalCollectionScope } from "@/store/local-collection-store";

/**
 * Bind all local user-scoped persistence buckets to one account.
 * Call on login, signup, session restore, and logout (userId = null).
 */
export async function switchAuthenticatedLocalScope(
  userId: string | null,
): Promise<void> {
  await Promise.all([
    switchLocalCollectionScope(userId),
    switchCaptureInboxScope(userId),
    switchCaptureSessionsScope(userId),
  ]);
}
