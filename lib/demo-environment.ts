"use client";

import { developmentSeedRatings } from "@/lib/development-seed-ratings";
import { collectionService } from "@/lib/services/collection-service";
import { movieService } from "@/lib/services/movie-service";
import type {
  CollectionMembership,
  Invitation,
  Rating,
} from "@/lib/types";
import {
  DEFAULT_COLLABORATOR,
  DEFAULT_OWNER,
  DEFAULT_USERS,
} from "@/lib/users";
import { useCaptureStore } from "@/store/capture-store";
import {
  SEED_COLLECTION_IDS,
  useCollaborationStore,
} from "@/store/collaboration-store";
import { useLocalCollectionStore } from "@/store/local-collection-store";
import { useSessionStore } from "@/store/session-store";
import { useVoteStore } from "@/store/vote-store";

const DEMO_JOINED_AT = "2026-01-01T00:00:00.000Z";

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
  useCollaborationStore.setState((state) => ({
    users: DEFAULT_USERS,
    activeUserId: DEFAULT_OWNER.id,
    memberships: state.memberships.filter((entry) =>
      DEFAULT_USERS.some((user) => user.id === entry.userId),
    ),
    invitations: state.invitations.filter(
      (invitation) =>
        DEFAULT_USERS.some(
          (user) => user.id === invitation.invitedByUserId,
        ) &&
        (!invitation.acceptedByUserId ||
          DEFAULT_USERS.some(
            (user) =>
              user.id === invitation.acceptedByUserId,
          )),
    ),
    notifications: state.notifications.filter((notification) =>
      DEFAULT_USERS.some(
        (user) => user.id === notification.userId,
      ),
    ),
    activity: state.activity.filter((entry) =>
      DEFAULT_USERS.some((user) => user.id === entry.userId),
    ),
  }));
}

export function seedDemoLists() {
  const previous = useCollaborationStore.getState();
  const customMemberships = previous.memberships.filter(
    (entry) =>
      !SEED_COLLECTION_IDS.includes(entry.collectionId) &&
      DEFAULT_USERS.some((user) => user.id === entry.userId),
  );
  const memberships: CollectionMembership[] = [
    membership("date-night", DEFAULT_OWNER.id, "owner"),
    membership("date-night", DEFAULT_COLLABORATOR.id, "member"),
    membership("sci-fi", DEFAULT_OWNER.id, "owner"),
    membership("comfort-movies", DEFAULT_OWNER.id, "owner"),
    ...customMemberships,
  ];
  const pendingInvitation: Invitation = {
    id: "demo-invitation-sci-fi",
    collectionId: "sci-fi",
    invitedByUserId: DEFAULT_OWNER.id,
    token: "demo-join-sci-fi",
    status: "pending",
    createdAt: DEMO_JOINED_AT,
  };

  useCollaborationStore.setState({
    users: DEFAULT_USERS,
    activeUserId: DEFAULT_OWNER.id,
    memberships,
    invitations: [
      pendingInvitation,
      ...previous.invitations.filter(
        (invitation) =>
          !SEED_COLLECTION_IDS.includes(
            invitation.collectionId,
          ),
      ),
    ],
    notifications: previous.notifications,
    activity: previous.activity,
  });
}

export function seedDemoRatings() {
  useVoteStore.getState().replaceVotes(developmentSeedRatings);
  useSessionStore.getState().clearCurrentSession();
}

export function seedDemoRecommendations() {
  const byCollection = {
    ...useLocalCollectionStore.getState().byCollection,
  };
  for (const collection of collectionService.getAll()) {
    const seededItems = movieService
      .getCollectionMovies(collection.items)
      .map((item, index) => ({
        ...item,
        addedByUserId:
          collection.id !== "date-night" || index % 2 === 0
            ? DEFAULT_OWNER.id
            : DEFAULT_COLLABORATOR.id,
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
  const collection = collectionService.getById("date-night");
  if (!collection) return;
  const items = movieService.getCollectionMovies(collection.items);
  const readyRatings: Rating[] = items.flatMap((item, index) => {
    const vote = index < 3 ? "like" : "pass";
    return [
      {
        collectionId: collection.id,
        movieId: item.movie.id,
        userId: DEFAULT_OWNER.id,
        vote,
        votedAt: new Date("2026-07-19T12:00:00.000Z"),
      },
      {
        collectionId: collection.id,
        movieId: item.movie.id,
        userId: DEFAULT_COLLABORATOR.id,
        vote,
        votedAt: new Date("2026-07-19T12:05:00.000Z"),
      },
    ];
  });
  const otherRatings = developmentSeedRatings.filter(
    (rating) => rating.collectionId !== collection.id,
  );
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
