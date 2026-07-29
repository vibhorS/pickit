"use client";

import { developmentSeedRatings } from "@/lib/development-seed-ratings";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";
import type {
  CollectionMembership,
  Invitation,
  Rating,
} from "@/lib/types";
import { useAuthStore } from "@/store/auth-store";
import { useCaptureStore } from "@/store/capture-store";
import {
  SEED_COLLECTION_IDS,
  useCollaborationStore,
} from "@/store/collaboration-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useSessionStore } from "@/store/session-store";
import { useVoteStore } from "@/store/vote-store";

const DEMO_JOINED_AT = "2026-01-01T00:00:00.000Z";

function requireCanonicalOwnerId(): string {
  const profileId = useAuthStore.getState().profile?.id;
  const activeId = useCollaborationStore.getState().activeUserId;
  const ownerId = profileId || activeId;
  if (!ownerId) {
    throw new Error("Sign in before seeding demo data (canonical auth UUID required).");
  }
  return ownerId;
}

function membership(
  collectionId: string,
  userId: string,
  role: CollectionMembership["role"],
): CollectionMembership {
  return {
    id: `demo-membership-${collectionId}-${userId}`,
    collectionId,
    userId,
    role,
    joinedAt: DEMO_JOINED_AT,
  };
}

export function seedDemoCouple() {
  const ownerId = requireCanonicalOwnerId();
  const profile = useAuthStore.getState().profile!;
  useCollaborationStore.getState().adoptCanonicalIdentity({
    userId: ownerId,
    displayName: profile.displayName,
    email: profile.email,
    avatarUrl: profile.avatarUrl,
    color: profile.color,
    partnerUserId: useAuthStore.getState().partner.partner?.id ?? null,
  });
}

export function seedDemoLists() {
  const ownerId = requireCanonicalOwnerId();
  const previous = useCollaborationStore.getState();
  const customMemberships = previous.memberships.filter(
    (entry) =>
      !SEED_COLLECTION_IDS.includes(entry.collectionId) &&
      entry.userId === ownerId,
  );
  const memberships: CollectionMembership[] = [
    membership("date-night", ownerId, "owner"),
    membership("sci-fi", ownerId, "owner"),
    membership("comfort-movies", ownerId, "owner"),
    ...customMemberships,
  ];
  const pendingInvitation: Invitation = {
    id: "demo-invitation-sci-fi",
    collectionId: "sci-fi",
    invitedByUserId: ownerId,
    token: "demo-join-sci-fi",
    status: "pending",
    createdAt: DEMO_JOINED_AT,
  };

  useCollaborationStore.setState({
    activeUserId: ownerId,
    memberships,
    invitations: [
      pendingInvitation,
      ...previous.invitations.filter(
        (invitation) =>
          !SEED_COLLECTION_IDS.includes(invitation.collectionId),
      ),
    ],
  });
}

export function seedDemoRatings() {
  const ownerId = requireCanonicalOwnerId();
  const remapped = developmentSeedRatings.map((rating) => ({
    ...rating,
    userId: ownerId,
  }));
  useVoteStore.getState().replaceVotes(remapped);
  useSessionStore.getState().clearCurrentSession();
}

export function seedDemoRecommendations() {
  const ownerId = requireCanonicalOwnerId();
  const byCollection = {
    ...useLocalCollectionStore.getState().byCollection,
  };
  for (const collection of collectionService.getAll()) {
    const seededItems = movieService
      .getCollectionMovies(collection.items)
      .map((item, index) => ({
        ...item,
        addedByUserId: ownerId,
        addedAt:
          item.metadata?.savedAt ??
          new Date(
            Date.UTC(2026, 0, Math.min(index + 1, 28)),
          ).toISOString(),
      }));
    const seededMovieIds = new Set(
      seededItems.map((item) => item.movie.id),
    );
    byCollection[collection.id] = [
      ...seededItems,
      ...(byCollection[collection.id] ?? []).filter(
        (item) => !seededMovieIds.has(item.movie.id),
      ),
    ];
  }
  useLocalCollectionStore.setState({ byCollection });
}

export function seedReadyMovieNight() {
  seedDemoLists();
  const ownerId = requireCanonicalOwnerId();
  const collection = collectionService.getById("date-night");
  if (!collection) return;
  const items = movieService.getCollectionMovies(collection.items);
  const readyRatings: Rating[] = items.map((item, index) => {
    const vote = index < 3 ? "like" : "pass";
    return {
      collectionId: collection.id,
      movieId: item.movie.id,
      userId: ownerId,
      vote,
      votedAt: new Date("2026-07-19T12:00:00.000Z"),
    };
  });
  const otherRatings = developmentSeedRatings
    .filter((rating) => rating.collectionId !== collection.id)
    .map((rating) => ({ ...rating, userId: ownerId }));
  useVoteStore
    .getState()
    .replaceVotes([...otherRatings, ...readyRatings]);
  useSessionStore.getState().clearCurrentSession();
}

export function seedCompleteDemo() {
  seedDemoCouple();
  seedDemoLists();
  seedDemoRecommendations();
  seedReadyMovieNight();
  useCaptureStore.setState({ sessions: [] });
  useSessionStore.getState().clearCurrentSession();
}
