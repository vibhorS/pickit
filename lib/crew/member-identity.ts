import type { UserProfile } from "@/lib/types";

/** Optional name fields beyond UserProfile (e.g. auth metadata). */
export type CrewMemberNameFields = {
  displayName?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  email?: string | null;
};

/**
 * Resolve a crew member's visible label.
 * Priority: displayName → fullName → firstName → email → "Member"
 */
export function resolveCrewMemberLabel(
  profile: Pick<UserProfile, "displayName" | "email"> | null | undefined,
  extras?: Omit<CrewMemberNameFields, "displayName" | "email">,
): string {
  const candidates = [
    profile?.displayName,
    extras?.fullName,
    extras?.firstName,
    profile?.email,
  ];
  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "Member";
}

/** Initials from a display label (up to two characters). */
export function crewMemberInitials(label: string): string {
  const parts = label
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((part) => part !== "(You)");
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase();
}

export function resolveCrewMemberAvatarUrl(
  profile: Pick<UserProfile, "avatarUrl"> | null | undefined,
): string | null {
  const url = profile?.avatarUrl?.trim();
  return url || null;
}
