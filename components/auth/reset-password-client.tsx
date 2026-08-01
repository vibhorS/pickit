"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import {
  MIN_PASSWORD_LENGTH,
  validateNewPassword,
} from "@/lib/auth/password-reset";
import { cloudAuth } from "@/lib/auth/cloud-auth";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

type ResetPhase = "checking" | "ready" | "success" | "invalid";

const RECOVERY_WAIT_MS = 4000;
const RECOVERY_POLL_MS = 100;

/**
 * Password recovery page for Supabase PKCE.
 *
 * `createBrowserClient` performs exactly one PKCE exchange via
 * `detectSessionInUrl`. This page must not call `exchangeCodeForSession` or
 * read `?code` — it only waits for PASSWORD_RECOVERY / a recovery session.
 */
export function ResetPasswordClient() {
  const router = useRouter();
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
    let settled = false;

    function markReady() {
      if (cancelled || settled) return;
      settled = true;
      setPasswordRecoveryPending(true);
      setPhase("ready");
    }

    function markInvalid() {
      if (cancelled || settled) return;
      settled = true;
      setPasswordRecoveryPending(false);
      setPhase("invalid");
    }

    if (!isSupabaseConfigured()) {
      markInvalid();
      return;
    }

    const supabase = getSupabaseBrowserClient();

    // Subscribe before awaiting getSession so we do not miss PASSWORD_RECOVERY
    // when detectSessionInUrl finishes during initialize.
    const unsubscribe = cloudAuth.onAuthStateChange((_profile, event) => {
      if (event === "PASSWORD_RECOVERY") {
        markReady();
      }
    });

    async function waitForRecoverySession() {
      // Resolves only after client initialize — including detectSessionInUrl.
      const { data, error } = await supabase.auth.getSession();
      if (cancelled || settled) return;

      if (error) {
        markInvalid();
        return;
      }

      // Recovery redirect has already been exchanged into a session.
      if (data.session) {
        markReady();
        return;
      }

      // Bootstrap may still deliver PASSWORD_RECOVERY just after initialize.
      if (useAuthStore.getState().passwordRecoveryPending) {
        markReady();
        return;
      }

      const startedAt = Date.now();
      while (!cancelled && !settled && Date.now() - startedAt < RECOVERY_WAIT_MS) {
        if (useAuthStore.getState().passwordRecoveryPending) {
          markReady();
          return;
        }
        const session = await cloudAuth.getSession();
        if (session) {
          markReady();
          return;
        }
        await new Promise((resolve) =>
          window.setTimeout(resolve, RECOVERY_POLL_MS),
        );
      }

      markInvalid();
    }

    void waitForRecoverySession();

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [setPasswordRecoveryPending]);

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
                Reset link invalid or expired.
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

function friendlyResetUpdateError(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes("expired") ||
    lower.includes("invalid") ||
    lower.includes("already")
  ) {
    return "Reset link invalid or expired.";
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
