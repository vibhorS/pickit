"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { AuthError } from "@/lib/auth/auth-service";
import { cloudAuth } from "@/lib/auth/cloud-auth";
import {
  MIN_PASSWORD_LENGTH,
  PASSWORD_RESET_PATH,
  validateNewPassword,
} from "@/lib/auth/password-reset";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

type ResetPhase = "checking" | "ready" | "success" | "invalid";

function ResetPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const setPasswordRecoveryPending = useAuthStore(
    (state) => state.setPasswordRecoveryPending,
  );
  const clearError = useAuthStore((state) => state.clearError);
  const storeError = useAuthStore((state) => state.error);
  const profile = useAuthStore((state) => state.profile);

  const [phase, setPhase] = useState<ResetPhase>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setPasswordRecoveryPending(true);

    const unsubscribe = isSupabaseConfigured()
      ? cloudAuth.onAuthStateChange((_profile, event) => {
          if (event === "PASSWORD_RECOVERY") {
            setPasswordRecoveryPending(true);
            if (!cancelled) setPhase("ready");
          }
        })
      : () => undefined;

    async function establishRecoverySession() {
      if (!isSupabaseConfigured()) {
        if (!cancelled) setPhase("invalid");
        return;
      }

      try {
        const code = searchParams.get("code");
        if (code) {
          await cloudAuth.exchangeCodeForSession(code);
          setPasswordRecoveryPending(true);
          if (!cancelled) {
            setPhase("ready");
            // Drop the one-time code from the URL after exchange.
            router.replace(PASSWORD_RESET_PATH);
          }
          return;
        }

        // Callback route should already have exchanged; wait briefly for session.
        for (let attempt = 0; attempt < 16; attempt += 1) {
          const session = await cloudAuth.getSession();
          if (session) {
            if (!cancelled) setPhase("ready");
            return;
          }
          await new Promise((resolve) => window.setTimeout(resolve, 200));
        }

        if (!cancelled) setPhase("invalid");
      } catch (error) {
        if (!cancelled) {
          setPhase("invalid");
          if (error instanceof AuthError) {
            setLocalError(error.message);
          }
        }
      }
    }

    void establishRecoverySession();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [searchParams, setPasswordRecoveryPending, router]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const passwordError = validateNewPassword(password);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Passwords do not match.");
      return;
    }

    setBusy(true);
    setLocalError(null);
    clearError();
    try {
      await updatePassword(password);
      setPhase("success");
      analytics.track("password_reset_completed");
      window.setTimeout(() => {
        router.replace("/");
      }, 1600);
    } catch {
      // store error
    } finally {
      setBusy(false);
    }
  }

  const displayError = localError ?? friendlyResetUpdateError(storeError);

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
          Choose a new password
        </p>

        {phase === "checking" && (
          <p className="mt-10 text-center text-sm text-netflix-muted">
            Verifying your reset link…
          </p>
        )}

        {phase === "invalid" && (
          <div className="mt-10 space-y-6">
            <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
              <p className="text-base font-semibold text-white">
                Link unavailable
              </p>
              <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
                {displayError ??
                  "This reset link is invalid, expired, or has already been used. Request a new one from the sign-in screen."}
              </p>
            </div>
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setPasswordRecoveryPending(false);
                router.replace("/");
              }}
            >
              Back to sign in
            </Button>
          </div>
        )}

        {phase === "success" && (
          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
            <p className="text-base font-semibold text-white">
              Password updated
            </p>
            <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
              {profile
                ? "You're signed in. Taking you to PickIt…"
                : "You can sign in with your new password."}
            </p>
          </div>
        )}

        {phase === "ready" && (
          <form onSubmit={submit} className="mt-10 space-y-4">
            <PasswordField
              label="New password"
              value={password}
              onChange={(value) => {
                setLocalError(null);
                clearError();
                setPassword(value);
              }}
              autoComplete="new-password"
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              required
              minLength={MIN_PASSWORD_LENGTH}
              disabled={busy}
            />
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={(value) => {
                setLocalError(null);
                clearError();
                setConfirmPassword(value);
              }}
              autoComplete="new-password"
              placeholder="Re-enter your new password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              disabled={busy}
            />

            {displayError && (
              <p className="text-sm text-red-300" role="alert">
                {displayError}
              </p>
            )}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ResetPasswordClient() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-netflix-black text-netflix-muted">
          <p className="text-sm tracking-wide">Verifying your reset link…</p>
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}

function friendlyResetUpdateError(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes("expired") ||
    lower.includes("invalid") ||
    lower.includes("already")
  ) {
    return "This reset link is invalid or has expired. Request a new one.";
  }
  if (lower.includes("match") || lower.includes("different")) {
    return message;
  }
  if (lower.includes("password") && lower.includes("8")) {
    return "Your password needs to be at least 8 characters.";
  }
  if (lower.includes("network") || lower.includes("connection")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  return "We couldn't update your password. Please try again.";
}
