"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import type {
  CloudList,
  CloudPreferences,
  CloudRating,
  CloudRecommendation,
} from "@/lib/repositories/cloud/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cloudSyncEngine } from "@/lib/sync/cloud-sync-engine";
import type { Movie } from "@/lib/types";

export const queryKeys = {
  lists: (userId: string) => ["lists", userId] as const,
  recommendations: (userId: string) => ["recommendations", userId] as const,
  ratings: (userId: string) => ["ratings", userId] as const,
  preferences: (userId: string) => ["preferences", userId] as const,
  movies: (ids: string[]) => ["movies", ...ids] as const,
};

export function useCloudLists(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.lists(userId ?? "anonymous"),
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: () => getCloudRepositories().lists.listForOwner(userId!),
  });
}

export function useCloudRecommendations(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.recommendations(userId ?? "anonymous"),
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: () => getCloudRepositories().recommendations.listForOwner(userId!),
  });
}

export function useCloudRatings(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.ratings(userId ?? "anonymous"),
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: () => getCloudRepositories().ratings.listForUser(userId!),
  });
}

export function useCloudPreferences(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.preferences(userId ?? "anonymous"),
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: () => getCloudRepositories().preferences.get(userId!),
  });
}

export function useUpsertList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (list: CloudList) => {
      await cloudSyncEngine.enqueue({
        entityType: "collection",
        entityId: list.id,
        operation: "upsert",
        payload: list,
      });
      if (navigator.onLine) {
        return getCloudRepositories().lists.upsert(list);
      }
      return list;
    },
    onSuccess: (list) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.lists(list.ownerId),
      });
    },
  });
}

export function useUpsertRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      recommendation: CloudRecommendation;
      movie: Movie;
      ownerId: string;
    }) => {
      await getCloudRepositories().movies.upsert(input.movie);
      await cloudSyncEngine.enqueue({
        entityType: "recommendation",
        entityId: input.recommendation.id,
        operation: "upsert",
        payload: input.recommendation,
      });
      if (navigator.onLine) {
        return getCloudRepositories().recommendations.upsert(
          input.recommendation,
        );
      }
      return input.recommendation;
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.recommendations(variables.ownerId),
      });
    },
  });
}

export function useUpsertRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rating: CloudRating) => {
      await cloudSyncEngine.enqueue({
        entityType: "rating",
        entityId: `${rating.listId}:${rating.movieId}:${rating.userId}`,
        operation: "upsert",
        payload: rating,
      });
      if (navigator.onLine) {
        return getCloudRepositories().ratings.upsert(rating);
      }
      return rating;
    },
    onSuccess: (_data, rating) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ratings(rating.userId),
      });
    },
  });
}

export function useUpsertPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: CloudPreferences) =>
      getCloudRepositories().preferences.upsert(prefs),
    onSuccess: (prefs) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.preferences(prefs.userId),
      });
    },
  });
}
