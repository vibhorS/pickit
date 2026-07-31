"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PASSWORD_RESET_PATH } from "@/lib/auth/password-reset";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

type Mode = "sign-in" | "sign-up" | "forgot-password";

function friendlyAuthMessage(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "That email or password doesn't look right. Try again.";
  }
  if (lower.includes("email not confirmed")) {
    return "Check your inbox and confirm your email, then sign in.";
  }
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }
  if (lower.includes("password")) {
    return "Your password needs to be at least 8 characters.";
  }
  if (lower.includes("network") || lower.includes("fetch")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't complete that sign-in step. Please try again.";
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const profile = useAuthStore((state) => state.profile);
  const error = useAuthStore((state) => state.error);
  const signIn = useAuthStore((state) => state.signIn);
  const signUp = useAuthStore((state) => state.signUp);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);
  const continueAsGuest = useAuthStore((state) => state.continueAsGuest);
  const clearError = useAuthStore((state) => state.clearError);
  const cloudConfigured = useAuthStore((state) => state.cloudConfigured);
  const passwordRecoveryPending = useAuthStore(
    (state) => state.passwordRecoveryPending,
  );

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const uiError = friendlyAuthMessage(error);

  const isInviteRoute = pathname.startsWith("/invite/");
  const isResetPasswordRoute = pathname.startsWith(PASSWORD_RESET_PATH);
  const isPublicRoute = isInviteRoute || isResetPasswordRoute;

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
      analytics.setContext({ userId: profile.id });
      analytics.identify(profile.id, {
        provider: profile.provider,
        isGuest: profile.isGuest,
      });
      analytics.track("app_opened");
    }
  }, [profile]);

  useEffect(() => {
    analytics.screen("landing_auth", { route: pathname });
    analytics.track("landing_viewed", { route: pathname });
  }, [pathname]);

  useEffect(() => {
    if (passwordRecoveryPending && !isResetPasswordRoute) {
      router.replace(PASSWORD_RESET_PATH);
    }
  }, [passwordRecoveryPending, isResetPasswordRoute, router]);

  if (isPublicRoute) return <>{children}</>;

  if (passwordRecoveryPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
        <p className="text-sm tracking-wide">Opening password reset…</p>
      </div>
    );
  }

  if (profile) return <>{children}</>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    clearError();
    try {
      if (mode === "sign-in") {
        await signIn({ email, password });
        analytics.track("login", { provider: "email" });
        analytics.track("auth_signed_in", { provider: "email" });
      } else if (mode === "sign-up") {
        await signUp({ email, password, displayName });
        analytics.track("sign_up_completed", { provider: "email" });
        analytics.track("account_created", { provider: "email" });
        analytics.track("auth_signed_up", { provider: "email" });
      }
    } catch (err) {
      analytics.error("auth_submit_failed", {
        mode,
        reason:
          err instanceof Error ? err.message.slice(0, 180) : "unknown-auth-error",
      });
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
          {mode === "forgot-password"
            ? "Reset your password"
            : "Stop scrolling. Start watching — together."}
        </p>

        {!cloudConfigured && (
          <p
            role="status"
            className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-100"
          >
            Cloud sync isn&apos;t available yet. You can still use PickIt in local
            mode on this device.
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

        {mode === "forgot-password" ? (
          <ForgotPasswordForm
            initialEmail={email}
            onBackToSignIn={() => {
              clearError();
              setMode("sign-in");
            }}
          />
        ) : (
          <>
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
              <PasswordField
                label="Password"
                value={password}
                onChange={(value) => {
                  clearError();
                  setPassword(value);
                }}
                required
                minLength={8}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                placeholder="At least 8 characters"
              />

              {mode === "sign-in" && (
                <div className="-mt-1 flex justify-end">
                  <button
                    type="button"
                    className="min-h-11 text-sm text-netflix-muted underline-offset-2 hover:text-white hover:underline"
                    onClick={() => {
                      clearError();
                      setMode("forgot-password");
                      analytics.track("password_reset_started");
                    }}
                  >
                    Forgot your password?
                  </button>
                </div>
              )}

              {uiError && (
                <p className="text-sm text-red-300" role="alert">
                  {uiError}
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
                      analytics.track("login", { provider: "guest" }),
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
                      analytics.track("sign_up_started", { entry: "auth_gate" });
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
          </>
        )}
      </div>
    </div>
  );
}
