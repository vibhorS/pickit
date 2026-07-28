"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuthStore } from "@/store/auth-store";
import { useCollaborationStore } from "@/store/collaboration-store";

type AcceptInvitationClientProps = {
  token: string;
};

export function AcceptInvitationClient({
  token,
}: AcceptInvitationClientProps) {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useAuthStore((state) => state.profile);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const invitations = useCollaborationStore(
    (state) => state.invitations,
  );
  const acceptInvitation = useCollaborationStore(
    (state) => state.acceptInvitation,
  );
  const revokeInvitation = useCollaborationStore(
    (state) => state.revokeInvitation,
  );

  useEffect(() => {
    const finish = () => setHydrated(true);
    const unsubscribe =
      useCollaborationStore.persist.onFinishHydration(finish);
    if (useCollaborationStore.persist.hasHydrated()) {
      queueMicrotask(finish);
    }
    return unsubscribe;
  }, []);

  if (!hydrated) {
    return (
      <p className="text-center text-sm text-netflix-muted">
        Opening invitation…
      </p>
    );
  }

  const invitation = invitations.find((entry) => entry.token === token);
  if (
    !invitation ||
    invitation.status === "revoked" ||
    invitation.status === "cancelled" ||
    invitation.status === "declined"
  ) {
    return (
      <EmptyState
        emoji="🔗"
        title="Invite unavailable"
        description="This invitation does not exist or is no longer active."
      />
    );
  }

  if (invitation.status === "accepted") {
    return (
      <div className="text-center">
        <p className="text-4xl" aria-hidden="true">
          ✓
        </p>
        <h1 className="mt-4 text-3xl font-bold text-white">
          You&apos;re connected
        </h1>
        <button
          type="button"
          onClick={() =>
            router.push(`/collection/${invitation.collectionId}`)
          }
          className="btn-primary mt-7"
        >
          Open List
        </button>
      </div>
    );
  }

  async function handleAccept() {
    let name = profile?.displayName;
    if (!name) {
      await continueAsGuest();
      name = useAuthStore.getState().profile?.displayName ?? "Guest";
    }
    const user = acceptInvitation(token, name);
    if (!user) {
      setError("You may already be a member of this list.");
      return;
    }
    router.push(`/collection/${invitation!.collectionId}`);
  }

  function handleDecline() {
    if (!invitation) return;
    // Mark declined via revoke for now (collection invite decline).
    revokeInvitation(invitation.id);
    useCollaborationStore.setState((state) => ({
      invitations: state.invitations.map((entry) =>
        entry.id === invitation.id
          ? {
              ...entry,
              status: "declined" as const,
              declinedAt: new Date().toISOString(),
            }
          : entry,
      ),
    }));
    router.push("/");
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl bg-netflix-surface px-6 py-8 shadow-[var(--shadow-elevated)] sm:px-8">
      <p className="text-4xl" aria-hidden="true">
        🎬
      </p>
      <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">
        Join this list
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-netflix-muted">
        {profile
          ? `Accept as ${profile.displayName} to rate independently and build a Movie Night queue together.`
          : "Sign in or continue as guest, then accept to join this shared list."}
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleAccept()}
        className="btn-primary mt-5 w-full"
      >
        Accept Invite
      </button>
      <button
        type="button"
        onClick={handleDecline}
        className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm text-netflix-muted hover:text-white"
      >
        Decline
      </button>
    </div>
  );
}
