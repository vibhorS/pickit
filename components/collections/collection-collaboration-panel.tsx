"use client";

import { Check, Copy, UserPlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getCollectionSharingState } from "@/lib/collaboration";
import { useCollaborationStore } from "@/store/collaboration-store";

type CollectionCollaborationPanelProps = {
  collectionId: string;
};

export function CollectionCollaborationPanel({
  collectionId,
}: CollectionCollaborationPanelProps) {
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const users = useCollaborationStore((state) => state.users);
  const memberships = useCollaborationStore(
    (state) => state.memberships,
  );
  const invitations = useCollaborationStore(
    (state) => state.invitations,
  );
  const activeUserId = useCollaborationStore(
    (state) => state.activeUserId,
  );
  const createInvitation = useCollaborationStore(
    (state) => state.createInvitation,
  );
  const ensureOwner = useCollaborationStore(
    (state) => state.ensureOwner,
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

  useEffect(() => {
    if (
      !hydrated ||
      memberships.some(
        (membership) => membership.collectionId === collectionId,
      )
    ) {
      return;
    }
    queueMicrotask(() => ensureOwner(collectionId));
  }, [collectionId, ensureOwner, hydrated, memberships]);

  if (!hydrated) return null;

  const collectionMemberships = memberships.filter(
    (membership) => membership.collectionId === collectionId,
  );
  const members = collectionMemberships.flatMap((membership) => {
    const user = users.find((entry) => entry.id === membership.userId);
    return user ? [{ user, membership }] : [];
  });
  const pendingInvite = invitations.find(
    (invitation) =>
      invitation.collectionId === collectionId &&
      invitation.status === "pending",
  );
  const sharingState = getCollectionSharingState(
    collectionId,
    memberships,
    invitations,
  );
  const activeMembership = collectionMemberships.find(
    (membership) => membership.userId === activeUserId,
  );
  const canInvite = activeMembership?.role === "owner";
  const inviteUrl = pendingInvite
    ? `${window.location.origin}/invite/${pendingInvite.token}`
    : null;

  function handleInvite() {
    createInvitation(collectionId);
    setCopied(false);
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="mt-7 max-w-3xl rounded-2xl bg-white/[0.025] px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-netflix-muted/75">
              Members
            </p>
            <SharingStatus state={sharingState} />
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {members.map(({ user, membership }) => {
              const active = user.id === activeUserId;
              return (
                <span
                  key={user.id}
                  className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm transition ${
                    active
                      ? "bg-white/[0.12] text-white"
                      : "bg-white/[0.04] text-netflix-muted"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex size-6 items-center justify-center rounded-full text-[0.65rem] font-semibold text-white"
                    style={{
                      backgroundColor:
                        user.color ?? "rgba(229,9,20,0.35)",
                    }}
                  >
                    {user.name.slice(0, 1).toUpperCase()}
                  </span>
                  {user.name}
                  {membership.role === "owner" && (
                    <span className="text-[0.625rem] uppercase tracking-wide text-netflix-muted/60">
                      Owner
                    </span>
                  )}
                  {active && (
                    <span className="text-[0.625rem] text-white/45">
                      You
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {canInvite && <div className="shrink-0">
          {pendingInvite ? (
            <div className="max-w-xs space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-amber-200">
                  Pending Invite
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="btn-ghost min-h-9 gap-1.5 px-3 py-1.5"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "Copied" : "Copy Link"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    revokeInvitation(pendingInvite.id)
                  }
                  aria-label="Cancel pending invitation"
                  className="btn-ghost min-h-9 px-2.5 py-1.5"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <code className="block truncate text-netflix-muted/60">
                {inviteUrl}
              </code>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleInvite}
              className="btn-ghost min-h-10 gap-2 px-3"
            >
              <UserPlus className="size-4" />
              {members.length > 1 ? "Invite Another" : "Invite Member"}
            </button>
          )}
        </div>}
      </div>
    </section>
  );
}

function SharingStatus({
  state,
}: {
  state: ReturnType<typeof getCollectionSharingState>;
}) {
  if (state === "connected") {
    return (
      <span className="text-xs font-medium text-emerald-300/85">
        ● Connected
      </span>
    );
  }
  if (state === "invitation-pending") {
    return (
      <span className="text-xs font-medium text-amber-200">
        ● Invitation Pending
      </span>
    );
  }
  return (
    <span className="text-xs font-medium text-netflix-muted/65">
      ○ Not Shared
    </span>
  );
}
