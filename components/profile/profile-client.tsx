"use client";

import Link from "next/link";
import {
  Bug,
  ChevronRight,
  ExternalLink,
  Info,
  LogOut,
  MessageSquare,
  Moon,
  Scale,
  Shield,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import { CrewPanel } from "@/components/crew/crew-panel";
import { PartnerPanel } from "@/components/partner/partner-panel";
import { BetaDashboard } from "@/components/profile/beta-dashboard";
import { SyncDashboard } from "@/components/profile/sync-dashboard";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { Toast } from "@/components/ui/empty-state";
import {
  seedCompleteDemo,
  seedDemoCouple,
  seedDemoLists,
  seedDemoRatings,
  seedDemoRecommendations,
  seedReadyMovieNight,
} from "@/lib/demo-environment";
import { analytics } from "@/lib/observability/analytics";
import { sanitizePlainText } from "@/lib/security/sanitize";
import { useAuthStore } from "@/store/auth-store";
import { useCollectionStats } from "@/store/collection-stats-selector";
import { useSettingsStore } from "@/store/settings-store";

const AVATAR_PRESETS = [
  null,
  "https://api.dicebear.com/9.x/thumbs/svg?seed=pickit-a",
  "https://api.dicebear.com/9.x/thumbs/svg?seed=pickit-b",
  "https://api.dicebear.com/9.x/thumbs/svg?seed=pickit-c",
  "https://api.dicebear.com/9.x/thumbs/svg?seed=pickit-d",
];

const COLORS = ["#e50914", "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b"];

const UTILITIES = [
  {
    label: "Seed Couple",
    description: "Create two local member identities.",
    run: seedDemoCouple,
  },
  {
    label: "Seed Lists",
    description: "Create not shared, pending, and connected states.",
    run: seedDemoLists,
  },
  {
    label: "Seed Ratings",
    description: "Add independent ratings for both members.",
    run: seedDemoRatings,
  },
  {
    label: "Seed Recommendations",
    description: "Assign recommendations to both members.",
    run: seedDemoRecommendations,
  },
  {
    label: "Seed Ready Movie Night",
    description: "Make Date Night ready with three mutual matches.",
    run: seedReadyMovieNight,
  },
] as const;

type SettingsSection =
  | "profile"
  | "crew"
  | "partner"
  | "appearance"
  | "privacy"
  | "feedback"
  | "about"
  | "developer";

export function ProfileClient() {
  const profile = useAuthStore((state) => state.profile);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const pendingOps = useAuthStore((state) => state.pendingOps);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const logout = useAuthStore((state) => state.logout);
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const seedDemo = useAuthStore((state) => state.seedDemo);

  const developerMode = useSettingsStore((state) => state.developerMode);
  const setDeveloperMode = useSettingsStore((state) => state.setDeveloperMode);
  const appearance = useSettingsStore((state) => state.appearance);
  const setAppearance = useSettingsStore((state) => state.setAppearance);
  const analyticsOptIn = useSettingsStore((state) => state.analyticsOptIn);
  const setAnalyticsOptIn = useSettingsStore(
    (state) => state.setAnalyticsOptIn,
  );

  const [section, setSection] = useState<SettingsSection>("profile");
  const [devUnlockTaps, setDevUnlockTaps] = useState(0);
  const [developerUnlocked, setDeveloperUnlocked] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const stats = useCollectionStats("date-night");

  useEffect(() => {
    if (profile) setDisplayName(profile.displayName);
  }, [profile]);

  useEffect(() => {
    analytics.track("settings_opened");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  if (!profile) return null;

  async function saveProfile() {
    await updateProfile({ displayName });
    setToast("Profile saved");
  }

  const navItems: Array<{
    id: SettingsSection;
    label: string;
    icon: typeof Info;
  }> = [
    { id: "profile", label: "Profile", icon: Info },
    { id: "crew", label: "Crew", icon: Users },
  ];
  if (!isSupabaseConfigured()) {
    navItems.push({ id: "partner", label: "Partner", icon: MessageSquare });
  }
  navItems.push(
    { id: "appearance", label: "Appearance", icon: Moon },
    { id: "privacy", label: "Privacy", icon: Shield },
    { id: "feedback", label: "Feedback", icon: Bug },
    { id: "about", label: "About", icon: Scale },
  );
  if (developerMode || developerUnlocked) {
    navItems.push({ id: "developer", label: "Developer", icon: Wrench });
  }

  return (
    <>
      <div className="mx-auto w-full max-w-3xl pb-24">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
          Settings
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          {profile.displayName}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-netflix-muted sm:text-base">
          {profile.email ?? "Guest account"} · Sync: {syncStatus}
          {pendingOps > 0 ? ` (${pendingOps} queued)` : ""}
        </p>

        <nav
          aria-label="Settings sections"
          className="mt-8 flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSection(id)}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition ${
                  active
                    ? "bg-white text-netflix-black"
                    : "bg-white/[0.05] text-netflix-muted hover:text-white"
                }`}
              >
                <Icon className="size-3.5" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>

        {section === "profile" && (
          <section className="mt-10">
            <h2 className="text-sm font-semibold text-white">Profile</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div
                className="flex size-16 items-center justify-center overflow-hidden rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: profile.color }}
                aria-hidden="true"
              >
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  profile.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {AVATAR_PRESETS.map((url, index) => (
                  <button
                    key={url ?? "none"}
                    type="button"
                    aria-label={url ? `Avatar option ${index}` : "No avatar"}
                    onClick={() =>
                      void updateProfile({ avatarUrl: url }).then(() =>
                        setToast("Avatar updated"),
                      )
                    }
                    className={`size-11 overflow-hidden rounded-full border-2 ${
                      profile.avatarUrl === url
                        ? "border-netflix-red"
                        : "border-white/15"
                    }`}
                    style={{ backgroundColor: url ? undefined : profile.color }}
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Accent color ${color}`}
                  onClick={() =>
                    void updateProfile({ color }).then(() =>
                      setToast("Color updated"),
                    )
                  }
                  className={`size-11 rounded-full border-2 ${
                    profile.color === color
                      ? "border-white"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            <div className="mt-6 max-w-sm">
              <Input
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
              />
            </div>
            <Button className="mt-4" onClick={() => void saveProfile()}>
              Save profile
            </Button>

            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  analytics.track("logout");
                  analytics.reset();
                  void logout();
                }}
              >
                <LogOut className="mr-2 size-4" aria-hidden="true" />
                Sign out
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      "Delete this account and its local data? This cannot be undone.",
                    )
                  ) {
                    analytics.reset();
                    void deleteAccount();
                  }
                }}
              >
                <Trash2 className="mr-2 size-4" aria-hidden="true" />
                Delete account
              </Button>
            </div>
          </section>
        )}

        {section === "crew" && <CrewPanel />}
        {section === "partner" && !isSupabaseConfigured() && <PartnerPanel />}

        {section === "appearance" && (
          <section className="mt-10 space-y-4">
            <h2 className="text-sm font-semibold text-white">Appearance</h2>
            <Surface>
              <p className="text-sm text-white">Theme</p>
              <p className="mt-1 text-xs text-netflix-muted">
                PickIt is designed for a dark cinema atmosphere. Light mode may
                arrive later.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["dark", "system"] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setAppearance(option)}
                    className={`min-h-11 rounded-full px-4 text-sm font-medium capitalize ${
                      appearance === option
                        ? "bg-white text-netflix-black"
                        : "bg-white/[0.05] text-netflix-muted"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </Surface>
          </section>
        )}

        {section === "privacy" && (
          <section className="mt-10 space-y-4">
            <h2 className="text-sm font-semibold text-white">Privacy</h2>
            <Surface>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white">Product analytics</p>
                  <p className="mt-1 text-xs leading-relaxed text-netflix-muted">
                    Anonymous events help improve PickIt (ratings completed,
                    Movie Night finished). No movie plot data is sold.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsOptIn}
                  onClick={() => setAnalyticsOptIn(!analyticsOptIn)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    analyticsOptIn ? "bg-netflix-red" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 size-6 rounded-full bg-white transition ${
                      analyticsOptIn ? "left-5" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
            </Surface>
            <Surface>
              <p className="text-sm text-white">Local-first data</p>
              <p className="mt-1 text-xs leading-relaxed text-netflix-muted">
                Lists, ratings, and sessions stay on this device until cloud sync
                is enabled. Sign out clears your session; delete account removes
                stored credentials for this browser.
              </p>
            </Surface>
          </section>
        )}

        {section === "feedback" && (
          <FeedbackSection
            onSubmitted={() => setToast("Thanks — feedback noted")}
          />
        )}

        {section === "about" && (
          <section className="mt-10 space-y-4">
            <h2 className="text-sm font-semibold text-white">About PickIt</h2>
            <Surface>
              <p className="text-sm leading-relaxed text-netflix-muted">
                PickIt helps two people stop scrolling and start watching. It is
                a decision engine for movie night — not a movie database.
              </p>
              <button
                type="button"
                onClick={() => {
                  const next = devUnlockTaps + 1;
                  setDevUnlockTaps(next);
                  if (next >= 7 && !developerUnlocked) {
                    setDeveloperUnlocked(true);
                    setToast("Developer tools unlocked");
                  }
                }}
                className="mt-3 text-xs text-white/40"
              >
                Version 0.3.0 · Closed beta
              </button>
            </Surface>
            <Surface>
              <p className="text-sm font-medium text-white">TMDb attribution</p>
              <p className="mt-2 text-xs leading-relaxed text-netflix-muted">
                This product uses the TMDb API but is not endorsed or certified
                by TMDb. Movie data and posters courtesy of{" "}
                <a
                  href="https://www.themoviedb.org/"
                  target="_blank"
                  rel="noreferrer"
                  className="text-white underline-offset-2 hover:underline"
                >
                  The Movie Database
                </a>
                .
              </p>
            </Surface>
            <Surface>
              <p className="text-sm font-medium text-white">Open source licenses</p>
              <p className="mt-2 text-xs leading-relaxed text-netflix-muted">
                PickIt is built with Next.js, React, Zustand, Framer Motion, and
                Lucide. Full license texts ship with each package in{" "}
                <code className="text-white/70">node_modules</code>.
              </p>
              <a
                href="https://github.com/"
                className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-white"
              >
                View project on GitHub
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Surface>
            <Link
              href="/collections"
              className="inline-flex min-h-11 items-center gap-2 text-sm text-netflix-muted hover:text-white"
            >
              Browse your lists
              <ChevronRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        )}

        {section === "developer" && (
          <section className="mt-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">
                  Developer mode
                </h2>
                <p className="mt-1 text-xs text-netflix-muted">
                  Seed tools for QA. Keep this off during closed beta demos.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={developerMode}
                onClick={() => setDeveloperMode(!developerMode)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                  developerMode ? "bg-netflix-red" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-6 rounded-full bg-white transition ${
                    developerMode ? "left-5" : "left-0.5"
                  }`}
                />
              </button>
            </div>

            {!developerMode ? (
              <Surface className="mt-6">
                <Badge tone="warning">Off</Badge>
                <p className="mt-3 text-sm text-netflix-muted">
                  Enable developer mode to access seed utilities.
                </p>
              </Surface>
            ) : (
              <>
                <p className="mt-6 text-sm text-netflix-muted">
                  Date Night readiness: {stats.readinessLabel} ·{" "}
                  {stats.mutualMatches} mutual matches
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {UTILITIES.map((utility) => (
                    <button
                      key={utility.label}
                      type="button"
                      onClick={() => {
                        utility.run();
                        setToast(`${utility.label} complete`);
                      }}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.06]"
                    >
                      <p className="text-sm font-medium text-white">
                        {utility.label}
                      </p>
                      <p className="mt-1 text-xs text-netflix-muted">
                        {utility.description}
                      </p>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      seedCompleteDemo();
                      void seedDemo().then(() =>
                        setToast("Full collaborative demo seeded"),
                      );
                    }}
                    className="rounded-2xl border border-netflix-red/40 bg-netflix-red/10 p-4 text-left hover:bg-netflix-red/15 sm:col-span-2"
                  >
                    <p className="text-sm font-medium text-white">
                      Seed complete collaborative demo
                    </p>
                    <p className="mt-1 text-xs text-netflix-muted">
                      Two connected users, shared lists, pending invite, and
                      Movie Night fixtures.
                    </p>
                  </button>
                </div>
                {isSupabaseConfigured() && (
                  <div className="mt-6">
                    <h3 className="text-sm font-semibold text-white">
                      Crew cloud tools
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {(
                        [
                          {
                            label: "Seed Movies",
                            description: "Upsert demo TMDb movies.",
                            run: async () => {
                              const { crewDemoTools } = await import(
                                "@/lib/services/crew/demo-tools"
                              );
                              await crewDemoTools.seedMovies();
                            },
                          },
                          {
                            label: "Seed Movie Night",
                            description:
                              "Create list + recs + ratings + activity.",
                            run: async () => {
                              const { crewDemoTools } = await import(
                                "@/lib/services/crew/demo-tools"
                              );
                              await crewDemoTools.seedMovieNight(profile.id);
                            },
                          },
                          {
                            label: "Seed Activity",
                            description:
                              "Append a Movie Night completed event.",
                            run: async () => {
                              const { crewDemoTools } = await import(
                                "@/lib/services/crew/demo-tools"
                              );
                              await crewDemoTools.seedActivity(profile.id);
                            },
                          },
                          {
                            label: "Reset Crew",
                            description:
                              "Rename Crew and cancel pending invite.",
                            run: async () => {
                              const { crewDemoTools } = await import(
                                "@/lib/services/crew/demo-tools"
                              );
                              await crewDemoTools.resetCrew(profile.id);
                            },
                          },
                        ] as const
                      ).map((utility) => (
                        <button
                          key={utility.label}
                          type="button"
                          onClick={() => {
                            void utility.run().then(
                              () => setToast(`${utility.label} complete`),
                              (err: unknown) =>
                                setToast(
                                  err instanceof Error
                                    ? err.message
                                    : `${utility.label} failed`,
                                ),
                            );
                          }}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left hover:bg-white/[0.06]"
                        >
                          <p className="text-sm font-medium text-white">
                            {utility.label}
                          </p>
                          <p className="mt-1 text-xs text-netflix-muted">
                            {utility.description}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <SyncDashboard />
                <BetaDashboard />
              </>
            )}
          </section>
        )}
      </div>
      {toast && <Toast message={toast} />}
    </>
  );
}

function FeedbackSection({ onSubmitted }: { onSubmitted: () => void }) {
  const profile = useAuthStore((state) => state.profile);
  const syncStatus = useAuthStore((state) => state.syncStatus);
  const [kind, setKind] = useState<"bug" | "feature" | "support">("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    const diagnostics = {
      kind,
      userId: profile?.id,
      provider: profile?.provider,
      syncStatus,
      userAgent:
        typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      online: typeof navigator !== "undefined" ? navigator.onLine : true,
      href: typeof window !== "undefined" ? window.location.href : "",
      at: new Date().toISOString(),
    };
    const cleanMessage = sanitizePlainText(message);
    if (!cleanMessage) return;
    analytics.track("feedback_submitted", {
      kind,
      length: cleanMessage.length,
    });
    // Local capture for beta — replace with support inbox webhook later.
    try {
      const key = "pickit-feedback-inbox";
      const existing = JSON.parse(
        window.localStorage.getItem(key) ?? "[]",
      ) as unknown[];
      existing.unshift({
        message: cleanMessage,
        diagnostics,
      });
      window.localStorage.setItem(
        key,
        JSON.stringify(existing.slice(0, 50)),
      );
    } catch {
      // ignore quota errors
    }
    setMessage("");
    setBusy(false);
    onSubmitted();
  }

  return (
    <section className="mt-10">
      <h2 className="text-sm font-semibold text-white">Feedback</h2>
      <p className="mt-2 text-sm text-netflix-muted">
        Report a bug, suggest a feature, or contact support. Diagnostics are
        attached automatically.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["bug", "Report bug"],
              ["feature", "Suggest feature"],
              ["support", "Contact support"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setKind(id)}
              className={`min-h-11 rounded-full px-4 text-sm font-medium ${
                kind === id
                  ? "bg-white text-netflix-black"
                  : "bg-white/[0.05] text-netflix-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="text-xs font-medium text-netflix-muted">Message</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength={2000}
            rows={5}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-white outline-none focus:border-netflix-red/70 focus:ring-2 focus:ring-netflix-red/40"
            placeholder="What happened? What did you expect?"
          />
        </label>
        <Button type="submit" disabled={busy || !message.trim()}>
          {busy ? "Sending…" : "Send feedback"}
        </Button>
      </form>
    </section>
  );
}
