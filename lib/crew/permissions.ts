import type { CrewMember, CrewRole } from "@/lib/crew/types";
import type { Collection } from "@/lib/types";
import {
  can as collectionCan,
  type PermissionAction,
  type PermissionContext,
} from "@/lib/services/collaboration/permissions";

const CREW_OWNER_ACTIONS: PermissionAction[] = [
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

/** Members can share the list fully; only delete is owner-gated. */
const CREW_MEMBER_ACTIONS: PermissionAction[] = [
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

const CREW_ADMIN_ACTIONS: PermissionAction[] = [
  ...CREW_MEMBER_ACTIONS,
  "list.manage-members",
  "list.invite",
  "list.restore",
];

function crewRoleAllows(role: CrewRole, action: PermissionAction): boolean {
  if (role === "owner") return CREW_OWNER_ACTIONS.includes(action);
  if (role === "admin") return CREW_ADMIN_ACTIONS.includes(action);
  return CREW_MEMBER_ACTIONS.includes(action);
}

export type CrewPermissionContext = PermissionContext & {
  crewId?: string | null;
  crewMembers?: CrewMember[];
  /** When true, use Crew role instead of per-list membership. */
  useCrewRoles?: boolean;
};

/**
 * Centralized Crew + list permissions.
 * Lists belong to a Crew — every member can view/edit/rate; delete is owner-only.
 */
export function canCrew(
  action: PermissionAction,
  ctx: CrewPermissionContext,
): boolean {
  if (action === "partner.invite" || action === "list.invite") {
    const membership = ctx.crewMembers?.find((m) => m.userId === ctx.userId);
    return Boolean(
      membership &&
        (membership.role === "owner" || membership.role === "admin"),
    );
  }

  if (action === "partner.disconnect") {
    return Boolean(
      ctx.crewMembers?.some((m) => m.userId === ctx.userId),
    );
  }

  if (ctx.useCrewRoles && ctx.crewMembers?.length) {
    const membership = ctx.crewMembers.find((m) => m.userId === ctx.userId);
    if (!membership) {
      if (
        ctx.collection?.ownerId === ctx.userId ||
        ctx.collection?.createdBy === ctx.userId
      ) {
        return CREW_OWNER_ACTIONS.includes(action);
      }
      return false;
    }

    if (ctx.collection?.deletedAt) {
      return action === "list.restore" && membership.role === "owner";
    }

    if (
      ctx.collection?.archivedAt &&
      action !== "list.restore" &&
      action !== "list.view"
    ) {
      return (
        (membership.role === "owner" || membership.role === "admin") &&
        action === "list.archive"
      );
    }

    return crewRoleAllows(membership.role, action);
  }

  return collectionCan(action, ctx);
}

export function assertCanCrew(
  action: PermissionAction,
  ctx: CrewPermissionContext,
): void {
  if (!canCrew(action, ctx)) {
    throw new Error(`Not allowed to ${action}`);
  }
}

export function getCrewRoleLabel(role: CrewRole): string {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return "Member";
}

export function isCrewList(
  collection: Collection | null | undefined,
  crewId: string | null | undefined,
): boolean {
  if (!collection || !crewId) return false;
  return collection.householdId === crewId;
}
