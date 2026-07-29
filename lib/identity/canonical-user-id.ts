/**
 * Canonical identity = Supabase Auth user UUID (or local auth profile.id).
 * Legacy demo usernames ("vibhor" / "urvashi") must never remain as runtime userIds.
 */

export const LEGACY_OWNER_ID = "vibhor";
export const LEGACY_COLLABORATOR_ID = "urvashi";

export const LEGACY_USER_IDS = new Set<string>([
  LEGACY_OWNER_ID,
  LEGACY_COLLABORATOR_ID,
]);

export function isLegacyUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return LEGACY_USER_IDS.has(userId);
}

export function isCanonicalUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  // Auth UUIDs and locally minted ids (user-… / guest-…) are canonical.
  // Legacy demo usernames are not.
  return !isLegacyUserId(userId);
}

/**
 * Map a stored userId onto the authenticated identity.
 * - Legacy owner → authenticated user
 * - Legacy collaborator → partner UUID when known; otherwise drop (null)
 * - Already-canonical ids pass through
 */
export function remapUserId(
  userId: string,
  canonicalUserId: string,
  partnerUserId: string | null,
): string | null {
  if (userId === LEGACY_OWNER_ID) return canonicalUserId;
  if (userId === LEGACY_COLLABORATOR_ID) {
    return partnerUserId && partnerUserId !== canonicalUserId
      ? partnerUserId
      : null;
  }
  if (userId === "you") return canonicalUserId;
  if (userId === "partner") {
    return partnerUserId && partnerUserId !== canonicalUserId
      ? partnerUserId
      : null;
  }
  return userId;
}
