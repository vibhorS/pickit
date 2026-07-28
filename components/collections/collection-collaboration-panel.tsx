"use client";

import { Check, Copy, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCollectionSharingState } from "@/lib/collaboration";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useCrewStore } from "@/store/crew-store";

type CollectionCollaborationPanelProps = {
  collectionId: string;
};

export function CollectionCollaborationPanel({
  collectionId,
}: CollectionCollaborationPanelProps) {
  const [hydrated, setHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const users = useCollaborationStore((state) => state.users);
  const memberships = useCollaborationStore((state) => state.memberships);
  const invitations = useCollaborationStore((state) => state.invitations);
  const activeUserId = useCollaborationStore((state) => state.activeUserId);
  const createInvitation = useCollaborationStore(
    (state) => state.createInvitation,
  );
  const ensureOwner = useCollaborationStore((state) => state.ensureOwner);
  const revokeInvitation = useCollaborationStore(
    (state) => state.revokeInvitation,
  );
  const crew = useCrewStore((state) => state.crew);
  const crewMembers = useCrewStore((state) => state.members);
  const pendingCrewInvite = useCrewStore((state) => state.pendingInvite);

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

  if (isSupabaseConfigured() && crew) {
    const inviteUrl = pendingCrewInvite
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/crew/${pendingCrewInvite.token}`
      : null;

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
                Crew Members
              </p>
              <span className="text-[0.65rem] text-emerald-400/90">
                Shared with Crew
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {crewMembers.map((member) => {
                const name = member.profile?.displayName ?? "Member";
                const active = member.userId === activeUserId;
                return (
                  <span
                    key={member.id}
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
                          member.profile?.color ?? "rgba(229,9,20,0.35)",
                      }}
                    >
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    {name}
                    {member.role === "owner" && (
                      <span className="text-[0.625rem] uppercase tracking-wide text-netflix-muted/60">
                        Owner
                      </span>
                    )}
                    {active && (
                      <span className="text-[0.625rem] text-white/45">You</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {inviteUrl && (
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white"
              >
                {copied ? (
                  <Check className="size-4 text-emerald-400" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copied ? "Copied" : "Copy Crew invite"}
              </button>
            )}
            <Link
              href="/crew"
              className="inline-flex items-center gap-2 rounded-xl bg-netflix-red/90 px-3 py-2 text-sm font-medium text-white"
            >
              <Users className="size-4" aria-hidden="true" />
              Your Crew
            </Link>
          </div>
        </div>
      </section>
    );
  }

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
                    <span className="text-[0.625rem] text-white/45">You</span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {canInvite && (
          <div className="shrink-0">
            {!pendingInvite ? (
              <button
                type="button"
                onClick={handleInvite}
                className="inline-flex items-center gap-2 rounded-xl bg-netflix-red/90 px-3 py-2 text-sm font-medium text-white"
              >
                <Users className="size-4" aria-hidden="true" />
                Invite
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/[0.06] px-3 py-2 text-sm text-white"
                >
                  {copied ? (
                    <Check className="size-4 text-emerald-400" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    pendingInvite && revokeInvitation(pendingInvite.id)
                  }
                  className="rounded-xl px-3 py-2 text-sm text-netflix-muted"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
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
      <span className="text-[0.65rem] text-emerald-400/90">Connected</span>
    );
  }
  if (state === "invitation-pending") {
    return (
      <span className="text-[0.65rem] text-amber-300/90">Invite pending</span>
    );
  }
  return (
    <span className="text-[0.65rem] text-netflix-muted/70">Not shared</span>
  );
}
