"use client";

import { Check, Copy, Link2, Users, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CrewMemberPresence } from "@/components/crew/crew-presence";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { getCrewRoleLabel } from "@/lib/crew/permissions";
import { analytics } from "@/lib/observability/analytics";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { crewService } from "@/lib/services/crew/crew-service";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";

export function CrewPanel() {
  const profile = useAuthStore((state) => state.profile);
  const crew = useCrewStore((state) => state.crew);
  const members = useCrewStore((state) => state.members);
  const pendingInvite = useCrewStore((state) => state.pendingInvite);
  const setSnapshot = useCrewStore((state) => state.setSnapshot);
  const [token, setToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingInvite) setToken(pendingInvite.token);
  }, [pendingInvite]);

  useEffect(() => {
    if (members.length > 1) analytics.track("crew_connected");
  }, [members.length]);

  if (!isSupabaseConfigured()) {
    return (
      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-netflix-red" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">Your Crew</h2>
        </div>
        <p className="mt-2 text-sm text-netflix-muted">
          Connect Supabase to invite people to your Crew and collaborate live.
        </p>
      </section>
    );
  }

  async function refresh() {
    if (!profile) return;
    const snapshot = await crewService.getSnapshot(profile.id);
    setSnapshot(snapshot);
  }

  async function handleInvite() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const { token: next } = await crewService.invite(profile.id);
      setToken(next);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!token) return;
    const url = `${window.location.origin}/invite/crew/${token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function cancelInvite() {
    if (!profile) return;
    setBusy(true);
    try {
      await crewService.cancelInvite(profile.id);
      setToken(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function leaveCrew() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      await crewService.leaveCrew(profile.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not leave Crew.");
    } finally {
      setBusy(false);
    }
  }

  const others = members.filter((m) => m.userId !== profile?.id);
  const myRole = members.find((m) => m.userId === profile?.id)?.role;

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-netflix-red" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">
            {crew?.name ?? "Your Crew"}
          </h2>
        </div>
        <Link
          href="/crew"
          className="text-xs text-netflix-muted underline-offset-2 hover:text-white hover:underline"
        >
          Open Crew
        </Link>
      </div>
      <p className="mt-2 text-sm text-netflix-muted">
        Shared lists, ratings, and Movie Night — our movie space.
      </p>

      <Surface className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const name = member.profile?.displayName ?? "Member";
            return (
              <div
                key={member.id}
                className="flex min-w-[10rem] flex-col gap-1 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="flex size-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{
                      backgroundColor: member.profile?.color ?? "#e50914",
                    }}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm text-white">
                      {name}
                      {member.userId === profile?.id ? " (You)" : ""}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-wide text-netflix-muted">
                      {getCrewRoleLabel(member.role)}
                    </p>
                  </div>
                </div>
                {member.userId !== profile?.id && (
                  <CrewMemberPresence
                    userId={member.userId}
                    displayName={name}
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}

        {others.length === 0 && !token && (
          <Button disabled={busy} onClick={() => void handleInvite()}>
            <Link2 className="mr-2 size-4" aria-hidden="true" />
            Invite to Crew
          </Button>
        )}

        {(token || pendingInvite) && (
          <div>
            <p className="text-sm text-white">Invite pending</p>
            <p className="mt-1 text-xs text-netflix-muted">
              Share this link so they can join your Crew.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void copyLink()}>
                {copied ? (
                  <Check
                    className="mr-2 size-4 text-emerald-400"
                    aria-hidden="true"
                  />
                ) : (
                  <Copy className="mr-2 size-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy invite link"}
              </Button>
              {(myRole === "owner" || myRole === "admin") && (
                <Button
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void cancelInvite()}
                >
                  <X className="mr-2 size-4" aria-hidden="true" />
                  Cancel invite
                </Button>
              )}
            </div>
          </div>
        )}

        {others.length > 0 && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => void leaveCrew()}
          >
            <UserMinus className="mr-2 size-4" aria-hidden="true" />
            Leave Crew
          </Button>
        )}
      </Surface>
    </section>
  );
}
