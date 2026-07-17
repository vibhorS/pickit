"use client";

import { useEffect, useState } from "react";
import { PARTNER_USER } from "@/lib/users";
import { usePartnerStore } from "@/store/partner-store";

type PartnerInvitePanelProps = {
  collectionId: string;
};

export function PartnerInvitePanel({
  collectionId,
}: PartnerInvitePanelProps) {
  const [hasHydrated, setHasHydrated] = useState(false);
  const [copied, setCopied] = useState(false);
  const byCollection = usePartnerStore((state) => state.byCollection);
  const generateInvite = usePartnerStore((state) => state.generateInvite);
  const markJoined = usePartnerStore((state) => state.markJoined);
  const getState = usePartnerStore((state) => state.getState);

  useEffect(() => {
    const unsub = usePartnerStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });
    if (usePartnerStore.persist.hasHydrated()) {
      setHasHydrated(true);
    }
    return unsub;
  }, []);

  if (!hasHydrated) return null;

  const partnerState = byCollection[collectionId] ?? getState(collectionId);
  const inviteUrl =
    partnerState.inviteCode != null
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${partnerState.inviteCode}`
      : null;

  function handleGenerate() {
    generateInvite(collectionId);
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
    <section className="rounded-2xl border border-white/5 bg-netflix-surface px-5 py-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] sm:px-6">
      {partnerState.status === "joined" ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">
              Partner connected
            </p>
            <p className="mt-1 text-sm text-netflix-muted">
              Rating with {PARTNER_USER.name}. Mutual matches unlock Tonight&apos;s
              Picks.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-netflix-red/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-netflix-red">
            {PARTNER_USER.name}
          </span>
        </div>
      ) : partnerState.status === "waiting" ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-bold text-white">Waiting for Partner</p>
            <p className="mt-1 text-sm text-netflix-muted">
              Share this invite link. They&apos;ll join and start rating asynchronously.
            </p>
          </div>
          {inviteUrl && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <code className="flex-1 truncate rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-xs text-netflix-muted">
                {inviteUrl}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10"
              >
                {copied ? "Copied" : "Copy Link"}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => markJoined(collectionId)}
            className="rounded-xl bg-netflix-red px-4 py-3 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Simulate Partner Joined
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-white">Invite a partner</p>
            <p className="mt-1 text-sm text-netflix-muted">
              Decide together once they join and rate the same collection.
            </p>
          </div>
          <button
            type="button"
            onClick={handleGenerate}
            className="shrink-0 rounded-xl bg-netflix-red px-5 py-3 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
          >
            Generate Invite Link
          </button>
        </div>
      )}
    </section>
  );
}
