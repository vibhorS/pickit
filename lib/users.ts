import type { User } from "@/lib/types";

export const DEFAULT_OWNER: User = {
  id: "vibhor",
  name: "Vibhor",
  color: "#e50914",
};

export const DEFAULT_COLLABORATOR: User = {
  id: "urvashi",
  name: "Urvashi",
  color: "#8b5cf6",
};

/**
 * Seed identities for local demo / migration.
 * Live identity comes from AuthenticationService + auth-store.
 */
export const DEFAULT_USERS: User[] = [
  DEFAULT_OWNER,
  DEFAULT_COLLABORATOR,
];
