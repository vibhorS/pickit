"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createCrewRepository } from "@/lib/repositories/cloud/crew-repository";
import { analytics } from "@/lib/observability/analytics";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { crewService } from "@/lib/services/crew/crew-service";
import type { CrewInvitation } from "@/lib/crew/types";
import type { UserProfile } from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";

export function AcceptCrewInviteClient() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const setSnapshot = useCrewStore((state) => state.setSnapshot);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<CrewInvitation | null>(null);
  const [inviter, setInviter] = useState<UserProfile | null>(null);
  const [crewName, setCrewName] = useState("a Crew");

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setError("Cloud is required to join a Crew.");
      return;
    }
    let cancelled = false;
    async function load() {
      const repo = createCrewRepository();
      const next = await repo.getInvitationByToken(token);
      if (cancelled) return;
      setInvite(next);
      if (next) {
        const crew = await repo.getById(next.crewId);
        if (!cancelled && crew) setCrewName(crew.name);
        const { getSupabaseBrowserClient } = await import(
          "@/lib/supabase/client"
        );
        const supabase = getSupabaseBrowserClient();
        const { data } = await supabase
          .from("users")
          .select("*")
          .eq("id", next.invitedByUserId)
          .maybeSingle();
        if (!cancelled && data) {
          setInviter({
            id: String(data.id),
            displayName: String(data.display_name),
            email: (data.email as string | null) ?? null,
            avatarUrl: (data.avatar_url as string | null) ?? null,
            color: String(data.color ?? "#e50914"),
            provider: (data.provider as UserProfile["provider"]) || "email",
            isGuest: Boolean(data.is_guest),
            createdAt: String(data.created_at),
            updatedAt: String(data.updated_at),
          });
        }
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
      const current = useAuthStore.getState().profile;
      if (!current) throw new Error("Sign in to accept this invite.");
      const snapshot = await crewService.acceptInvite(token, current);
      setSnapshot(snapshot);
      analytics.track("invite_accepted", { crewId: snapshot.crew?.id ?? null });
      router.push("/crew");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept invite.");
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    setError(null);
    try {
      await ensureSignedIn();
      const current = useAuthStore.getState().profile;
      if (!current) return;
      await crewService.rejectInvite(token, current.id);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not decline invite.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured()) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">Cloud required</h1>
        <p className="mt-3 text-sm text-netflix-muted">
          Configure Supabase to accept Crew invites.
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

  if (invite && invite.status !== "pending") {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-3xl font-bold text-white">Invite unavailable</h1>
        <p className="mt-3 text-sm text-netflix-muted">
          This Crew invite is {invite.status}.
        </p>
        <Link
          href="/crew"
          className="mt-8 inline-block rounded-xl bg-netflix-red px-5 py-3 text-sm font-semibold text-white"
        >
          Open Your Crew
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
        Invite to Crew
      </p>
      <h1 className="mt-4 text-3xl font-bold text-white">Join {crewName}</h1>
      <p className="mt-3 text-sm text-netflix-muted">
        {inviter
          ? `${inviter.displayName} invited you to share lists, ratings, and Movie Night.`
          : "You were invited to share lists, ratings, and Movie Night."}
      </p>
      {profile && (
        <p className="mt-2 text-xs text-netflix-muted">
          Signed in as {profile.displayName}
        </p>
      )}
      {error && <p className="mt-4 text-sm text-rose-400">{error}</p>}
      <div className="mt-8 flex flex-col gap-3">
        <Button disabled={busy} onClick={() => void accept()}>
          Accept invitation
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => void reject()}
        >
          Decline
        </Button>
      </div>
    </div>
  );
}
