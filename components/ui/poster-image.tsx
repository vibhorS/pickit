"use client";

import { useState } from "react";

type PosterImageProps = {
  src: string;
  alt: string;
  className?: string;
  /** Eager for above-the-fold heroes; lazy for grids. */
  priority?: boolean;
};

/**
 * Poster with calm fade-in once loaded — never shows a blank hole.
 */
export function PosterImage({
  src,
  alt,
  className = "",
  priority = false,
}: PosterImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center bg-netflix-elevated text-xs text-netflix-muted ${className}`}
      >
        No poster
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-netflix-elevated">
      <div
        aria-hidden="true"
        className={`absolute inset-0 animate-pulse bg-white/[0.06] transition-opacity duration-200 ${
          loaded ? "opacity-0" : "opacity-100"
        }`}
      />
      <img
        src={src}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-200 ease-out ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className}`}
      />
    </div>
  );
}
