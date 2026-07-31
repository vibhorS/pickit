"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isValidEmailAddress } from "@/lib/auth/password-reset";
import { analytics } from "@/lib/observability/analytics";
import { useAuthStore } from "@/store/auth-store";

type ForgotPasswordFormProps = {
  initialEmail?: string;
  onBackToSignIn: () => void;
};

export function ForgotPasswordForm({
  initialEmail = "",
  onBackToSignIn,
}: ForgotPasswordFormProps) {
  const requestPasswordReset = useAuthStore(
    (state) => state.requestPasswordReset,
  );
  const clearError = useAuthStore((state) => state.clearError);
  const storeError = useAuthStore((state) => state.error);
  const cloudConfigured = useAuthStore((state) => state.cloudConfigured);

  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;

    const trimmed = email.trim();
    if (!isValidEmailAddress(trimmed)) {
      setLocalError("Enter a valid email address.");
      return;
    }
    if (!cloudConfigured) {
      setLocalError(
        "Password reset isn't available in local mode. Cloud authentication is required.",
      );
      return;
    }

    setBusy(true);
    setLocalError(null);
    clearError();
    try {
      await requestPasswordReset(trimmed);
      setSent(true);
      analytics.track("password_reset_requested");
    } catch {
      // error stored in auth store; still show success for non-thrown soft cases
    } finally {
      setBusy(false);
    }
  }

  const displayError = localError ?? friendlyResetRequestError(storeError);

  if (sent && !displayError) {
    return (
      <div className="mt-10 space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-5 text-center">
          <p className="text-base font-semibold text-white">Check your email</p>
          <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
            If an account exists for this email, we&apos;ve sent you a password
            reset link.
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          onClick={onBackToSignIn}
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      <p className="text-sm leading-relaxed text-netflix-muted">
        Enter the email for your PickIt account and we&apos;ll send a reset
        link.
      </p>
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={(event) => {
          setLocalError(null);
          clearError();
          setEmail(event.target.value);
        }}
        required
        autoComplete="email"
        placeholder="you@email.com"
        disabled={busy}
      />

      {displayError && (
        <p className="text-sm text-red-300" role="alert">
          {displayError}
        </p>
      )}

      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Sending…" : "Send reset link"}
      </Button>

      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-center text-sm text-netflix-muted underline-offset-2 hover:text-white hover:underline"
        onClick={onBackToSignIn}
        disabled={busy}
      >
        Back to sign in
      </button>
    </form>
  );
}

function friendlyResetRequestError(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (lower.includes("rate") || lower.includes("too many")) {
    return "Too many attempts right now. Please wait a moment and try again.";
  }
  if (lower.includes("network") || lower.includes("connection")) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (lower.includes("cloud") || lower.includes("local")) {
    return message;
  }
  return "We couldn't send a reset email. Please try again.";
}
