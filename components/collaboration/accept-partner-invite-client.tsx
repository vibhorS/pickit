"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getRepositories } from "@/lib/repositories/index";
import { analytics } from "@/lib/observability/analytics";
import type { PartnerRelationship, UserProfile } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";

export function AcceptPartnerInviteClient() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const acceptPartnerInvite = useAuthStore(
    (state) => state.acceptPartnerInvite,
  );
  const declinePartnerInvite = useAuthStore(
    (state) => state.declinePartnerInvite,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviter, setInviter] = useState<UserProfile | null>(null);
  const [relationship, setRelationship] =
    useState<PartnerRelationship | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const rel = await getRepositories().relationships.getByToken(token);
      if (cancelled) return;
      setRelationship(rel);
      if (rel) {
        const user = await getRepositories().users.getById(rel.inviterUserId);
        if (!cancelled) setInviter(user);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function ensureSignedIn() {
    if (useAuthStore.getState().profile) return;
    await continueAsGuest();
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      await acceptPartnerInvite(token);
      analytics.track("invite_accepted", { kind: "partner" });
      router.push("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      await declinePartnerInvite(token);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not decline invite.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (relationship && relationship.status !== "pending") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">Invite unavailable</h1>
        <p className="mt-3 text-sm text-netflix-muted">
          This partner invite is no longer active.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded-xl bg-netflix-red px-5 py-3 text-sm font-semibold text-white"
        >
          Back to PickIt
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
        Partner
      </p>
      <h1 className="mt-3 text-3xl font-bold text-white">
        {inviter
          ? `Join ${inviter.displayName}'s movie nights?`
          : "Accept partner invite?"}
      </h1>
      <p className="mt-3 text-sm text-netflix-muted">
        Accepting connects you as partners and shares your lists for
        collaborative ratings and Movie Night.
        {profile
          ? ` You'll join as ${profile.displayName}.`
          : " You'll continue as a guest if you don't have an account yet."}
      </p>
      {error && (
        <p className="mt-4 text-sm text-netflix-red" role="alert">
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="rounded-xl bg-netflix-red px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          Accept invite
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decline()}
          className="rounded-xl border border-white/15 px-5 py-3 text-sm text-white disabled:opacity-60"
        >
          Decline
        </button>
      </div>
    </div>
  );
}
