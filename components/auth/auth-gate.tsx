"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

type Mode = "sign-in" | "sign-up";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const profile = useAuthStore((state) => state.profile);
  const error = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const clearError = useAuthStore((state) => state.clearError);
  const cloudConfigured = useAuthStore((state) => state.cloudConfigured);

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  const isPublicRoute = pathname.startsWith("/invite/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  useEffect(() => {
    if (profile) {
      analytics.identify(profile.id, {
        provider: profile.provider,
        isGuest: profile.isGuest,
      });
      analytics.track("app_opened");
    }
  }, [profile]);

  if (profile || isPublicRoute) return <>{children}</>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    clearError();
    try {
      if (mode === "sign-in") {
        await signIn({ email, password });
        analytics.track("auth_signed_in", { provider: "email" });
      } else {
        await signUp({ email, password, displayName });
        analytics.track("auth_signed_up", { provider: "email" });
      }
    } catch {
      // error stored in auth store
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(229,9,20,0.35), transparent), radial-gradient(ellipse 60% 40% at 100% 50%, rgba(47,47,47,0.35), transparent)",
        }}
      />
      <div className="relative w-full max-w-md">
        <p className="text-center text-5xl font-bold tracking-tight text-white sm:text-6xl">
          PickIt
        </p>
        <p className="mt-3 text-center text-sm text-netflix-muted">
          Stop scrolling. Start watching — together.
        </p>

        {!cloudConfigured && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-100"
          >
            Cloud database is not configured. Add{" "}
            <code className="text-white/80">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-white/80">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>{" "}
            to <code className="text-white/80">.env.local</code>, then apply{" "}
            <code className="text-white/80">supabase/migrations</code>. Until
            then, PickIt uses a local development fallback.
          </p>
        )}

        {offline && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-xs text-amber-100"
          >
            You&apos;re offline. Guest mode still works with data saved on this
            device.
          </p>
        )}

        <form onSubmit={submit} className="mt-10 space-y-4">
          {mode === "sign-up" && (
            <Input
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              placeholder="Alex"
              autoComplete="nickname"
            />
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@email.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              clearError();
              setPassword(e.target.value);
            }}
            required
            minLength={8}
            autoComplete={
              mode === "sign-in" ? "current-password" : "new-password"
            }
            placeholder="At least 8 characters"
          />

          {error && (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy
              ? "Please wait…"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void signInWithGoogle().catch(() => undefined)}
          >
            Continue with Google
          </Button>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void signInWithApple().catch(() => undefined)}
          >
            Continue with Apple
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              void continueAsGuest()
                .then(() =>
                  analytics.track("auth_signed_in", { provider: "guest" }),
                )
                .catch(() => undefined);
            }}
          >
            Continue as guest
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-netflix-muted">
          {mode === "sign-in" ? (
            <>
              New here?{" "}
              <button
                type="button"
                className="min-h-11 text-white underline-offset-2 hover:underline"
                onClick={() => {
                  clearError();
                  setMode("sign-up");
                }}
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="min-h-11 text-white underline-offset-2 hover:underline"
                onClick={() => {
                  clearError();
                  setMode("sign-in");
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
