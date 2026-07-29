import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getCloudRepositories } from "@/lib/repositories/cloud";
import { crewService } from "@/lib/services/crew/crew-service";
import { createId } from "@/lib/repositories/local";
import type { Movie } from "@/lib/types";
import { logger } from "@/lib/observability/logger";

const DEMO_MOVIES: Movie[] = [
  {
    id: "27205",
    title: "Inception",
    year: 2010,
    runtime: 148,
    rating: 8.4,
    genres: ["Action", "Science Fiction"],
    overview: "A thief who steals corporate secrets through dream-sharing.",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/oYuK0YD5y0tG3xK8vqZf0X5qVqZ.jpg",
    mediaType: "movie",
  },
  {
    id: "157336",
    title: "Interstellar",
    year: 2014,
    runtime: 169,
    rating: 8.4,
    genres: ["Adventure", "Drama", "Science Fiction"],
    overview: "A team of explorers travel through a wormhole in space.",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
    mediaType: "movie",
  },
  {
    id: "496243",
    title: "Parasite",
    year: 2019,
    runtime: 132,
    rating: 8.5,
    genres: ["Comedy", "Thriller", "Drama"],
    overview:
      "Greed and class discrimination threaten a newly formed relationship.",
    posterUrl:
      "https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg",
    mediaType: "movie",
  },
];

/**
 * Developer utilities for Crew collaboration testing.
 * Requires signed-in cloud user + Supabase.
 */
export const crewDemoTools = {
  async seedMovies() {
    if (!isSupabaseConfigured()) throw new Error("Cloud required");
    const repos = getCloudRepositories();
    for (const movie of DEMO_MOVIES) {
      await repos.movies.upsert(movie);
    }
    return DEMO_MOVIES.length;
  },

  async seedLists(userId: string) {
    if (!isSupabaseConfigured()) throw new Error("Cloud required");
    const repos = getCloudRepositories();
    const crew = await repos.crew.ensurePersonalCrew(userId, "Demo");
    const now = new Date().toISOString();
    const list = {
      id: createId("list"),
      ownerId: userId,
      crewId: crew.id,
      name: "Demo Movie Night",
      emoji: "🎬",
      description: "Seeded for Crew QA",
      archivedAt: null as string | null,
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null as string | null,
    };
    await repos.lists.upsert(list);
    await crewService.recordActivity({
      crewId: crew.id,
      userId,
      type: "list-created",
      listId: list.id,
      summary: "New list created: Demo Movie Night",
    });
    return list;
  },

  async seedRatings(userId: string, listId: string) {
    if (!isSupabaseConfigured()) throw new Error("Cloud required");
    const repos = getCloudRepositories();
    await this.seedMovies();
    const now = new Date().toISOString();
    for (const movie of DEMO_MOVIES) {
      await repos.ratings.upsert({
        listId,
        movieId: movie.id,
        userId,
        vote: "like",
        votedAt: now,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
    const crew = await repos.crew.getActiveCrewForUser(userId);
    if (crew) {
      await crewService.recordActivity({
        crewId: crew.id,
        userId,
        type: "movie-rated",
        listId,
        summary: "Seeded Crew ratings",
      });
    }
    return DEMO_MOVIES.length;
  },

  async seedRecommendations(userId: string, listId: string) {
    if (!isSupabaseConfigured()) throw new Error("Cloud required");
    const repos = getCloudRepositories();
    await this.seedMovies();
    const now = new Date().toISOString();
    for (const movie of DEMO_MOVIES) {
      await repos.recommendations.upsert({
        id: crypto.randomUUID(),
        listId,
        movieId: movie.id,
        sourceType: "search",
        sourceLabel: "Demo",
        metadata: {},
        note: null,
        addedByUserId: userId,
        createdBy: userId,
        updatedBy: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
    const crew = await repos.crew.getActiveCrewForUser(userId);
    if (crew) {
      await crewService.recordActivity({
        crewId: crew.id,
        userId,
        type: "movie-added",
        listId,
        summary: "Seeded recommendations",
      });
    }
    return DEMO_MOVIES.length;
  },

  async seedActivity(userId: string) {
    const snapshot = await crewService.getSnapshot(userId);
    if (!snapshot) throw new Error("No Crew");
    await crewService.recordActivity({
      crewId: snapshot.crew.id,
      userId,
      type: "movie-night-completed",
      summary: "Movie Night completed",
    });
    return true;
  },

  async seedMovieNight(userId: string) {
    const list = await this.seedLists(userId);
    await this.seedRecommendations(userId, list.id);
    await this.seedRatings(userId, list.id);
    await this.seedActivity(userId);
    return list.id;
  },

  async resetCrew(userId: string) {
    if (!isSupabaseConfigured()) throw new Error("Cloud required");
    logger.info("Reset Crew requested", { userId });
    // Soft approach: rename + clear pending invites
    const snapshot = await crewService.getSnapshot(userId);
    if (!snapshot) return;
    await crewService.renameCrew(userId, "Our Crew");
    if (snapshot.pendingInvite) {
      await crewService.cancelInvite(userId);
    }
  },
};
