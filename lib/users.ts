import type { User } from "@/lib/types";
import {
  LEGACY_COLLABORATOR_ID,
  LEGACY_OWNER_ID,
} from "@/lib/identity/canonical-user-id";

/**
 * Display templates for demo UI only.
 * IDs are legacy and MUST be remapped to auth UUIDs via adoptCanonicalIdentity.
 * Never write these ids into new memberships at runtime.
 */
export const DEFAULT_OWNER: User = {
  id: LEGACY_OWNER_ID,
  name: "Vibhor",
  color: "#e50914",
};

export const DEFAULT_COLLABORATOR: User = {
  id: LEGACY_COLLABORATOR_ID,
  name: "Urvashi",
  color: "#8b5cf6",
};

/** @deprecated Prefer auth profile users. Kept for persist migrate of old localStorage. */
export const DEFAULT_USERS: User[] = [DEFAULT_OWNER, DEFAULT_COLLABORATOR];
