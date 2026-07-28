"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type OfflineStateProps = {
  onRetry?: () => void;
};

export function OfflineState({ onRetry }: OfflineStateProps) {
  return (
    <EmptyState
      icon={<WifiOff className="size-7" aria-hidden="true" />}
      title="You're offline"
      description="You can still browse lists and ratings saved on this device. We'll sync when you're back online."
      action={
        onRetry
          ? { label: "Try again", onClick: onRetry }
          : undefined
      }
      actionHref={
        onRetry ? undefined : { label: "Go home", href: "/" }
      }
    />
  );
}

type NetworkErrorStateProps = {
  title?: string;
  description?: string;
  onRetry?: () => void;
};

export function NetworkErrorState({
  title = "Something went wrong",
  description = "We couldn't reach the network. Check your connection and try again.",
  onRetry,
}: NetworkErrorStateProps) {
  return (
    <EmptyState
      emoji="📡"
      title={title}
      description={description}
      action={
        onRetry
          ? { label: "Retry", onClick: onRetry }
          : undefined
      }
    />
  );
}

type CancelledStateProps = {
  onContinue?: () => void;
};

export function CancelledState({ onContinue }: CancelledStateProps) {
  return (
    <div className="px-4 py-14 text-center">
      <h3 className="text-xl font-semibold text-white">Cancelled</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-netflix-muted">
        No changes were made.
      </p>
      {onContinue ? (
        <Button variant="secondary" className="mt-8" onClick={onContinue}>
          Continue
        </Button>
      ) : (
        <Link href="/" className="btn-secondary mt-8 inline-flex">
          Go home
        </Link>
      )}
    </div>
  );
}
