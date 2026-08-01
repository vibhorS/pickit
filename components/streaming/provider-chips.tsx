"use client";

import {
  displayProviderName,
} from "@/lib/streaming/provider-catalog";
import type { WatchAvailability, WatchProvider } from "@/lib/streaming/types";
import { ProviderLogo } from "@/components/streaming/provider-logo";

type ProviderChipsProps = {
  availability: WatchAvailability | null | undefined;
  /** Expanded TMDB provider ids the household owns. */
  householdProviderIds?: number[];
  /** When true, show “Currently unavailable to stream” if empty. */
  showUnavailable?: boolean;
  className?: string;
};

export function ProviderChips({
  availability,
  householdProviderIds = [],
  showUnavailable = true,
  className = "",
}: ProviderChipsProps) {
  if (!availability) {
    return null;
  }

  const providers = availability.providers;
  if (providers.length === 0) {
    if (!showUnavailable) return null;
    if (availability.status === "error") return null;
    return (
      <p
        className={`text-[0.625rem] leading-snug text-netflix-muted/60 ${className}`}
      >
        Currently unavailable to stream
      </p>
    );
  }

  const owned = new Set(householdProviderIds);
  const householdConfigured = householdProviderIds.length > 0;
  const matchesHousehold = householdConfigured
    ? providers.some((provider) => owned.has(provider.providerId))
    : true;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <p className="text-[0.625rem] font-medium uppercase tracking-[0.08em] text-netflix-muted/55">
        Available on
      </p>
      <ul className="flex flex-wrap items-center gap-1.5" aria-label="Available on">
        {providers.map((provider: WatchProvider) => (
          <li key={provider.providerId}>
            <ProviderLogo
              providerId={provider.providerId}
              name={displayProviderName(provider.providerId, provider.name)}
              logoPath={provider.logoPath}
            />
          </li>
        ))}
      </ul>
      {householdConfigured && !matchesHousehold ? (
        <p className="text-[0.625rem] leading-snug text-amber-200/75">
          Not included in your household subscriptions
        </p>
      ) : null}
    </div>
  );
}
