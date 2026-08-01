/**
 * Curated OTT catalog for Crew streaming preferences.
 * IDs are TMDB watch-provider ids (stable across regions).
 * logoPath values are TMDB CDN paths (w92) — refreshed Jul 2026.
 */

const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w92";

export type StreamingProviderOption = {
  id: number;
  name: string;
  shortName: string;
  /** TMDB logo path, e.g. "/abc.jpg" */
  logoPath: string | null;
};

/** Verified IN/US TMDB logo paths (HTTP 200 on image.tmdb.org). */
const LOGO = {
  netflix: "/pbpMk2JmcoNnQwx5JGpXngfoWtp.jpg",
  prime: "/pvske1MyAoymrs5bguRfVqYiM9a.jpg",
  jioHotstar: "/kVqjgpcwvDJOhCupjcLzwwtOp52.jpg",
  appleTv: "/mcbz1LgtErU9p4UdbZ0rG6RTWHX.jpg",
  sonyLiv: "/3973zlBbBXdXxaWqRWzGG2GYxbT.jpg",
  zee5: "/gP67NRy1ShUJilrzMsbOmEmdmcv.jpg",
  mubi: "/x570VpH2C9EKDf1riP83rYc5dnL.jpg",
  paramount: "/fts6X10Jn4QT0X6ac3udKEn2tJA.jpg",
  max: "/jbe4gVSfRlbPTdESXhEKpornsfu.jpg",
  crunchyroll: "/fzN5Jok5Ig1eJ7gyNGoMhnLSCfh.jpg",
} as const;

export const STREAMING_PROVIDER_CATALOG: StreamingProviderOption[] = [
  {
    id: 8,
    name: "Netflix",
    shortName: "Netflix",
    logoPath: LOGO.netflix,
  },
  {
    id: 119,
    name: "Amazon Prime Video",
    shortName: "Prime Video",
    logoPath: LOGO.prime,
  },
  {
    id: 2336,
    name: "JioHotstar",
    shortName: "JioHotstar",
    logoPath: LOGO.jioHotstar,
  },
  // Legacy Hotstar ids — keep for expand/match against older TMDB payloads.
  {
    id: 122,
    name: "Hotstar",
    shortName: "JioHotstar",
    logoPath: LOGO.jioHotstar,
  },
  {
    id: 2202,
    name: "JioHotstar",
    shortName: "JioHotstar",
    logoPath: LOGO.jioHotstar,
  },
  {
    id: 350,
    name: "Apple TV",
    shortName: "Apple TV+",
    logoPath: LOGO.appleTv,
  },
  {
    id: 237,
    name: "Sony Liv",
    shortName: "Sony LIV",
    logoPath: LOGO.sonyLiv,
  },
  {
    id: 232,
    name: "Zee5",
    shortName: "ZEE5",
    logoPath: LOGO.zee5,
  },
  {
    id: 11,
    name: "MUBI",
    shortName: "MUBI",
    logoPath: LOGO.mubi,
  },
  {
    id: 531,
    name: "Paramount Plus",
    shortName: "Paramount+",
    logoPath: LOGO.paramount,
  },
  {
    id: 1899,
    name: "Max",
    shortName: "Max",
    logoPath: LOGO.max,
  },
  {
    id: 283,
    name: "Crunchyroll",
    shortName: "Crunchyroll",
    logoPath: LOGO.crunchyroll,
  },
];

const byId = new Map(
  STREAMING_PROVIDER_CATALOG.map((entry) => [entry.id, entry]),
);

export function getStreamingProviderOption(
  providerId: number,
): StreamingProviderOption | undefined {
  return byId.get(providerId);
}

export function displayProviderName(providerId: number, fallback: string) {
  return byId.get(providerId)?.shortName ?? fallback;
}

export function providerLogoUrl(
  logoPath: string | null | undefined,
  providerId?: number,
): string | null {
  const catalogPath =
    providerId != null ? byId.get(providerId)?.logoPath : null;
  // Prefer curated catalog paths — TMDB availability payloads can ship stale CDN paths.
  const path = catalogPath || logoPath || null;
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_LOGO_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Collapse Hotstar / JioHotstar aliases for preference UI. */
export function uniqueCatalogForPreferences(): StreamingProviderOption[] {
  const seen = new Set<string>();
  const result: StreamingProviderOption[] = [];
  for (const entry of STREAMING_PROVIDER_CATALOG) {
    if (seen.has(entry.shortName)) continue;
    seen.add(entry.shortName);
    result.push(entry);
  }
  return result;
}

/**
 * Expand a short preference selection into all matching TMDB provider ids
 * (e.g. JioHotstar → 2336 + 122 + 2202).
 */
export function expandCrewProviderIds(selectedIds: number[]): number[] {
  const selected = new Set(selectedIds);
  const shortNames = new Set(
    STREAMING_PROVIDER_CATALOG.filter((entry) => selected.has(entry.id)).map(
      (entry) => entry.shortName,
    ),
  );
  return STREAMING_PROVIDER_CATALOG.filter((entry) =>
    shortNames.has(entry.shortName),
  ).map((entry) => entry.id);
}
