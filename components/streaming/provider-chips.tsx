"use client";

import {
  displayProviderName,
  providerLogoUrl,
} from "@/lib/streaming/provider-catalog";
import type { WatchAvailability, WatchProvider } from "@/lib/streaming/types";

type ProviderChipsProps = {
  availability: WatchAvailability | null | undefined;
  /** Expanded TMDB provider ids the household owns. */
  householdProviderIds?: number[];
  /** When true, show “Currently unavailable to stream” if empty. */
  showUnavailable?: boolean;
  className?: string;
};

function ProviderLogo({
  provider,
}: {
  provider: Pick<WatchProvider, "providerId" | "name" | "logoPath">;
}) {
  const src = providerLogoUrl(provider.logoPath, provider.providerId);
  const label = displayProviderName(provider.providerId, provider.name);

  if (!src) {
    return (
      <span className="inline-flex max-w-full truncate rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[0.625rem] font-medium text-netflix-muted/85">
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- TMDB CDN logos; sizes vary by provider
    <img
      src={src}
      alt={label}
      title={label}
      width={28}
      height={28}
      loading="lazy"
      decoding="async"
      className="size-7 rounded-md bg-white/90 object-contain p-0.5 shadow-sm"
    />
  );
}

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
        {providers.map((provider) => (
          <li key={provider.providerId}>
            <ProviderLogo provider={provider} />
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
