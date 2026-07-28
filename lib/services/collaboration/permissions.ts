import type {
  Collection,
  CollectionMembership,
  MembershipRole,
  PartnerRelationship,
  User,
} from "@/lib/types";

export type PermissionAction =
  | "list.view"
  | "list.edit"
  | "list.rename"
  | "list.delete"
  | "list.archive"
  | "list.restore"
  | "list.duplicate"
  | "list.manage-members"
  | "list.invite"
  | "recommendation.add"
  | "recommendation.remove"
  | "recommendation.edit-note"
  | "rating.write"
  | "rating.read"
  | "movie-night.start"
  | "partner.invite"
  | "partner.disconnect";

export type PermissionContext = {
  userId: string;
  collection?: Collection | null;
  membership?: CollectionMembership | null;
  memberships?: CollectionMembership[];
  relationship?: PartnerRelationship | null;
  partnerUserId?: string | null;
};

const OWNER_ACTIONS: PermissionAction[] = [
  "list.view",
  "list.edit",
  "list.rename",
  "list.delete",
  "list.archive",
  "list.restore",
  "list.duplicate",
  "list.manage-members",
  "list.invite",
  "recommendation.add",
  "recommendation.remove",
  "recommendation.edit-note",
  "rating.write",
  "rating.read",
  "movie-night.start",
];

const PARTNER_ACTIONS: PermissionAction[] = [
  "list.view",
  "list.edit",
  "list.rename",
  "list.archive",
  "list.duplicate",
  "recommendation.add",
  "recommendation.remove",
  "recommendation.edit-note",
  "rating.write",
  "rating.read",
  "movie-night.start",
];

/** Crew members share lists fully; delete stays owner-only. */
const MEMBER_ACTIONS: PermissionAction[] = [
  "list.view",
  "list.edit",
  "list.rename",
  "list.archive",
  "list.duplicate",
  "recommendation.add",
  "recommendation.remove",
  "recommendation.edit-note",
  "rating.write",
  "rating.read",
  "movie-night.start",
];

function roleAllows(role: MembershipRole, action: PermissionAction): boolean {
  if (role === "owner") return OWNER_ACTIONS.includes(action);
  if (role === "partner") return PARTNER_ACTIONS.includes(action);
  return MEMBER_ACTIONS.includes(action);
}

/**
 * Centralized authorization. UI and stores should call this
 * instead of scattering membership checks.
 */
export function can(
  action: PermissionAction,
  ctx: PermissionContext,
): boolean {
  const { userId } = ctx;

  if (action === "partner.invite") {
    return Boolean(userId) && !ctx.partnerUserId;
  }

  if (action === "partner.disconnect") {
    return (
      ctx.relationship?.status === "connected" &&
      (ctx.relationship.inviterUserId === userId ||
        ctx.relationship.partnerUserId === userId)
    );
  }

  const membership =
    ctx.membership ??
    ctx.memberships?.find(
      (entry) =>
        entry.userId === userId &&
        entry.collectionId === ctx.collection?.id,
    );

  if (!membership) {
    // Owner of an unshared local list before membership is written.
    if (
      ctx.collection?.ownerId === userId ||
      ctx.collection?.createdBy === userId
    ) {
      return OWNER_ACTIONS.includes(action);
    }
    return false;
  }

  if (ctx.collection?.deletedAt) {
    return action === "list.restore" && membership.role === "owner";
  }

  if (ctx.collection?.archivedAt && action !== "list.restore" && action !== "list.view") {
    return membership.role === "owner" && action === "list.archive";
  }

  return roleAllows(membership.role, action);
}

export function assertCan(
  action: PermissionAction,
  ctx: PermissionContext,
): void {
  if (!can(action, ctx)) {
    throw new PermissionError(action);
  }
}

export class PermissionError extends Error {
  readonly action: PermissionAction;
  readonly code = "PERMISSION_DENIED" as const;

  constructor(action: PermissionAction) {
    super(`Not allowed to ${action}`);
    this.name = "PermissionError";
    this.action = action;
  }
}

export function getMemberRoleLabel(role: MembershipRole): string {
  if (role === "owner") return "Owner";
  if (role === "partner") return "Partner";
  return "Member";
}

export function describeOwnership(
  collection: Collection,
  users: User[],
  memberships: CollectionMembership[],
  currentUserId: string,
): string {
  const ownerMembership = memberships.find(
    (membership) =>
      membership.collectionId === collection.id &&
      membership.role === "owner",
  );
  const ownerId = ownerMembership?.userId ?? collection.ownerId;
  if (!ownerId) return "Shared list";
  if (ownerId === currentUserId) return "Owned by you";
  const owner = users.find((user) => user.id === ownerId);
  return owner ? `Owned by ${owner.name}` : "Shared list";
}
