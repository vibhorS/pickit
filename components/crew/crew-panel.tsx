"use client";

import { Check, Copy, Link2, MoreVertical, Pencil, Users, UserMinus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CrewMemberAvatar } from "@/components/crew/crew-member-avatar";
import { CrewMemberPresence } from "@/components/crew/crew-presence";
import { CrewStreamingPreferencesPanel } from "@/components/crew/crew-streaming-preferences";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { resolveCrewMemberLabel } from "@/lib/crew/member-identity";
import { getCrewRoleLabel } from "@/lib/crew/permissions";
import type { CrewMember } from "@/lib/crew/types";
import type { UserProfile } from "@/lib/types";
import { analytics } from "@/lib/observability/analytics";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { crewService } from "@/lib/services/crew/crew-service";
import { useAuthStore } from "@/store/auth-store";
import { useCrewStore } from "@/store/crew-store";

type MemberWithProfile = CrewMember & { profile: UserProfile | null };

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
  const [menuMemberId, setMenuMemberId] = useState<string | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<MemberWithProfile | null>(
    null,
  );
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

  async function confirmRemoveMember() {
    if (!profile || !pendingRemoval) return;
    setBusy(true);
    setError(null);
    try {
      const snapshot = await crewService.removeCrewMember(
        profile.id,
        pendingRemoval.userId,
      );
      setSnapshot(snapshot);
      setPendingRemoval(null);
      setMenuMemberId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not remove member.",
      );
    } finally {
      setBusy(false);
    }
  }

  const others = members.filter((m) => m.userId !== profile?.id);
  const myRole = members.find((m) => m.userId === profile?.id)?.role;
  const canRename = myRole === "owner";
  const canRemoveMembers = myRole === "owner";

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
            const isSelf = member.userId === profile?.id;
            const showOwnerMenu = canRemoveMembers && !isSelf;
            return (
              <div
                key={member.id}
                className="relative flex min-w-[10rem] flex-col gap-1 rounded-xl bg-white/[0.04] px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <CrewMemberAvatar profile={member.profile} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-white">
                      {name}
                      {isSelf ? " (You)" : ""}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-wide text-netflix-muted">
                      {getCrewRoleLabel(member.role)}
                    </p>
                  </div>
                  {showOwnerMenu ? (
                    <MemberOverflowMenu
                      open={menuMemberId === member.id}
                      disabled={busy}
                      onOpenChange={(open) =>
                        setMenuMemberId(open ? member.id : null)
                      }
                      onRemove={() => {
                        setMenuMemberId(null);
                        setPendingRemoval(member);
                      }}
                    />
                  ) : null}
                </div>
                {!isSelf && (
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

      {pendingRemoval ? (
        <RemoveMemberDialog
          displayName={resolveCrewMemberLabel(pendingRemoval.profile)}
          busy={busy}
          onCancel={() => setPendingRemoval(null)}
          onConfirm={() => void confirmRemoveMember()}
        />
      ) : null}
    </section>
  );
}

function MemberOverflowMenu({
  open,
  disabled,
  onOpenChange,
  onRemove,
}: {
  open: boolean;
  disabled?: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        onOpenChange(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Member actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        disabled={disabled}
        className="rounded-lg p-1.5 text-netflix-muted/70 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-40"
        onClick={() => onOpenChange(!open)}
      >
        <MoreVertical className="size-4" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-[10.5rem] rounded-lg border border-white/10 bg-netflix-black py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full px-3 py-2 text-left text-sm text-rose-300 transition hover:bg-white/[0.06]"
            onClick={onRemove}
          >
            Remove from Crew
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RemoveMemberDialog({
  displayName,
  busy,
  onCancel,
  onConfirm,
}: {
  displayName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-crew-member-title"
        className="w-full max-w-md rounded-2xl border border-white/10 bg-netflix-dark p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="remove-crew-member-title"
          className="text-lg font-semibold text-white"
        >
          Remove from Crew?
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-netflix-muted">
          &ldquo;{displayName}&rdquo; will lose access to this crew, shared
          collections, ratings and Movie Night.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" disabled={busy} onClick={onConfirm}>
            Remove Member
          </Button>
        </div>
      </div>
    </div>
  );
}
