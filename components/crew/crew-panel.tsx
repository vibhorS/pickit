"use client";

import { Check, Copy, Link2, Pencil, Users, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CrewMemberAvatar } from "@/components/crew/crew-member-avatar";
import { CrewMemberPresence } from "@/components/crew/crew-presence";
import { CrewStreamingPreferencesPanel } from "@/components/crew/crew-streaming-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { resolveCrewMemberLabel } from "@/lib/crew/member-identity";
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
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [crewNameDraft, setCrewNameDraft] = useState<string | null>(null);
  const token = createdToken ?? pendingInvite?.token ?? null;
  const nameDraft = crewNameDraft ?? crew?.name ?? "";

  useEffect(() => {
    if (!profile || !isSupabaseConfigured()) return;
    let cancelled = false;
    async function bootCrew() {
      setBusy(true);
      setError(null);
      try {
        await crewService.ensureCrew(profile!);
        if (cancelled) return;
        const snapshot = await crewService.getSnapshot(profile!.id);
        if (!cancelled) setSnapshot(snapshot);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load your Crew. Apply Phase 2B migrations in Supabase.",
          );
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void bootCrew();
    return () => {
      cancelled = true;
    };
  }, [profile, setSnapshot]);

  useEffect(() => {
    if (members.length > 1) analytics.track("crew_connected");
  }, [members.length]);

  useEffect(() => {
    analytics.setContext({ crewId: crew?.id ?? null });
  }, [crew?.id]);

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
    if (snapshot?.crew && members.length === 0) {
      analytics.track("crew_created", { crewId: snapshot.crew.id });
    }
  }

  async function handleRename() {
    if (!profile) return;
    const next = nameDraft.trim();
    if (!next || next === crew?.name) {
      setEditingName(false);
      setCrewNameDraft(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const renamed = await crewService.renameCrew(profile.id, next);
      useCrewStore.setState((state) => ({
        crew: state.crew
          ? { ...state.crew, name: renamed.name, updatedAt: renamed.updatedAt }
          : renamed,
      }));
      setCrewNameDraft(null);
      setEditingName(false);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename Crew.");
      setCrewNameDraft(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      const { token: next } = await crewService.invite(profile.id);
      setCreatedToken(next);
      analytics.track("invite_sent", { crewId: crew?.id ?? null });
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
    analytics.feature("invite_link_copied", { crewId: crew?.id ?? null });
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function cancelInvite() {
    if (!profile) return;
    setBusy(true);
    try {
      await crewService.cancelInvite(profile.id);
      setCreatedToken(null);
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
  const canRename = myRole === "owner";

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Users
            className="size-4 shrink-0 text-netflix-red"
            aria-hidden="true"
          />
          <h2 className="truncate text-sm font-semibold text-white">
            {crew?.name ?? "Your Crew"}
          </h2>
          {canRename && !editingName && (
            <button
              type="button"
              aria-label="Rename Crew"
              className="rounded-lg p-2 text-netflix-muted transition hover:bg-white/[0.06] hover:text-white"
              onClick={() => {
                setCrewNameDraft(crew?.name ?? "");
                setEditingName(true);
              }}
            >
              <Pencil className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <Link
          href="/crew"
          className="shrink-0 text-xs text-netflix-muted underline-offset-2 hover:text-white hover:underline"
        >
          Open Crew
        </Link>
      </div>
      <p className="mt-2 text-sm text-netflix-muted">
        Shared lists, ratings, and Movie Night — our movie space.
      </p>

      <Surface className="mt-4 space-y-4">
        {editingName && canRename && (
          <div className="space-y-3">
            <Input
              label="Crew name"
              value={nameDraft}
              onChange={(event) => setCrewNameDraft(event.target.value)}
              maxLength={60}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRename();
                }
                if (event.key === "Escape") {
                  setEditingName(false);
                  setCrewNameDraft(null);
                }
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={busy || !nameDraft.trim()}
                onClick={() => void handleRename()}
              >
                Save name
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setEditingName(false);
                  setCrewNameDraft(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {members.map((member) => {
            const name = resolveCrewMemberLabel(member.profile);
            return (
              <div
                key={member.id}
                className="flex min-w-[10rem] flex-col gap-1 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <CrewMemberAvatar profile={member.profile} />
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

        {crew ? <CrewStreamingPreferencesPanel crewId={crew.id} /> : null}
      </Surface>
    </section>
  );
}
