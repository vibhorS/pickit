export { authenticationService, AuthError } from "@/lib/auth/auth-service";
export { relationshipService } from "@/lib/services/collaboration/relationship-service";
export {
  invitationService,
  listService,
} from "@/lib/services/collaboration/invitation-service";
export {
  notificationService,
  presenceService,
} from "@/lib/services/collaboration/notification-service";
export {
  can,
  assertCan,
  PermissionError,
  describeOwnership,
} from "@/lib/services/collaboration/permissions";
export { syncEngine } from "@/lib/sync/sync-engine";
export { getRepositories, isCloudConfigured } from "@/lib/repositories/index";
export { domainEventBus, createEventId } from "@/lib/events/bus";
