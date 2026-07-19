import type { CapturePayload, CaptureSource } from "@/lib/capture/types";

const SOURCE_HOSTS: {
  host: string;
  type: CaptureSource["type"];
  label: string;
}[] = [
  { host: "instagram.com", type: "instagram", label: "Instagram" },
  { host: "reddit.com", type: "reddit", label: "Reddit" },
  { host: "youtu.be", type: "youtube", label: "YouTube" },
  { host: "youtube.com", type: "youtube", label: "YouTube" },
  { host: "letterboxd.com", type: "letterboxd", label: "Letterboxd" },
  { host: "imdb.com", type: "imdb", label: "IMDb" },
  { host: "netflix.com", type: "netflix", label: "Netflix" },
  { host: "tiktok.com", type: "tiktok", label: "TikTok" },
  { host: "twitter.com", type: "twitter", label: "Twitter" },
  { host: "x.com", type: "twitter", label: "Twitter" },
];

function findFirstUrl(content: string): URL | null {
  const match = content.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;

  try {
    return new URL(match[0]);
  } catch {
    return null;
  }
}

export function detectCaptureSource(payload: CapturePayload): CaptureSource {
  const url = findFirstUrl(payload.content);
  if (!url) {
    return { type: "plain-text", label: "Plain Text" };
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  const known = SOURCE_HOSTS.find(
    (source) =>
      hostname === source.host || hostname.endsWith(`.${source.host}`),
  );

  if (known) {
    return {
      type: known.type,
      label: known.label,
      hostname,
      url: url.toString(),
    };
  }

  return {
    type: "generic-url",
    label: "Web Link",
    hostname,
    url: url.toString(),
  };
}
