/**
 * Curated OTT catalog for Crew streaming preferences.
 * IDs are TMDB watch-provider ids (stable across regions).
 * logoPath values are TMDB CDN paths (w92).
 */

const TMDB_LOGO_BASE = "https://image.tmdb.org/t/p/w92";

export type StreamingProviderOption = {
  id: number;
  name: string;
  shortName: string;
  /** TMDB logo path, e.g. "/abc.jpg" */
  logoPath: string | null;
};

export const STREAMING_PROVIDER_CATALOG: StreamingProviderOption[] = [
  {
    id: 8,
    name: "Netflix",
    shortName: "Netflix",
    logoPath: "/t2yyOv40HZeVlLjYsCsPHnWLk4W.jpg",
  },
  {
    id: 119,
    name: "Amazon Prime Video",
    shortName: "Prime Video",
    logoPath: "/pvske1MyAoymrs5bguRgJQW8LEa.jpg",
  },
  {
    id: 122,
    name: "Hotstar",
    shortName: "JioHotstar",
    logoPath: "/bxBlFGE4QpzWmlMp7NhgfTBDiVf.jpg",
  },
  {
    id: 2202,
    name: "JioHotstar",
    shortName: "JioHotstar",
    logoPath: "/bxBlFGE4QpzWmlMp7NhgfTBDiVf.jpg",
  },
  {
    id: 350,
    name: "Apple TV",
    shortName: "Apple TV+",
    logoPath: "/6uhKBfmtzFqOcLousHwZuzcrScK.jpg",
  },
  {
    id: 237,
    name: "Sony Liv",
    shortName: "Sony LIV",
    logoPath: "/6ICjRAbshRiDyMx9icGKQP0XceG.jpg",
  },
  {
    id: 232,
    name: "Zee5",
    shortName: "ZEE5",
    logoPath: "/mPc8oLXh9kI8G2tD7pF4qJ8.jpg",
  },
  {
    id: 11,
    name: "MUBI",
    shortName: "MUBI",
    logoPath: "/bVR4Z1LCHYXnke1kBl9A5y0Q2d.jpg",
  },
  {
    id: 531,
    name: "Paramount Plus",
    shortName: "Paramount+",
    logoPath: "/h5DcR0J2EESUtRgPHmW2LAfG6tv.jpg",
  },
  {
    id: 1899,
    name: "Max",
    shortName: "Max",
    logoPath: "/6Q3ZYUNA35KWYwEBkg2QjaH4VpO.jpg",
  },
  {
    id: 283,
    name: "Crunchyroll",
    shortName: "Crunchyroll",
    logoPath: "/8Gt1iClBlzTeQs8WQm8UrCoIxnQ.jpg",
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
  const path =
    logoPath ||
    (providerId != null ? byId.get(providerId)?.logoPath : null) ||
    null;
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
 * (e.g. JioHotstar → 122 + 2202).
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
