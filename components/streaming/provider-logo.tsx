"use client";

import { useState } from "react";
import {
  displayProviderName,
  providerLogoUrl,
} from "@/lib/streaming/provider-catalog";

type ProviderLogoProps = {
  providerId: number;
  name: string;
  logoPath?: string | null;
  sizeClassName?: string;
};

/** TMDB provider mark with text fallback when the asset is missing or fails. */
export function ProviderLogo({
  providerId,
  name,
  logoPath,
  sizeClassName = "size-7",
}: ProviderLogoProps) {
  const src = providerLogoUrl(logoPath, providerId);
  const label = displayProviderName(providerId, name);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        title={label}
        className={`inline-flex ${sizeClassName} max-w-[4.5rem] items-center justify-center truncate rounded-md bg-white/[0.08] px-1 text-[0.5625rem] font-semibold leading-tight text-netflix-muted`}
      >
        {label.slice(0, 3).toUpperCase()}
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
      onError={() => setFailed(true)}
      className={`${sizeClassName} rounded-md bg-white/90 object-contain p-0.5 shadow-sm`}
    />
  );
}
