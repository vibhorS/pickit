import { movieNightLiveRepository } from "@/lib/movie-night/live/repository";
import type {
  MovieNightLiveSession,
  MovieNightVoteValue,
} from "@/lib/movie-night/live/types";
import { isSupabaseConfigured } from "@/lib/supabase/client";

export const movieNightLiveService = {
  async start(input: {
    crewId: string;
    listId: string;
    movieIds: string[];
  }): Promise<MovieNightLiveSession> {
    if (!isSupabaseConfigured()) {
      throw new Error("Cloud is required for live Movie Night.");
    }
    return movieNightLiveRepository.start(input);
  },

  async getActive(crewId: string): Promise<MovieNightLiveSession | null> {
    if (!isSupabaseConfigured()) return null;
    return movieNightLiveRepository.getActive(crewId);
  },

  async refresh(sessionId: string): Promise<MovieNightLiveSession | null> {
    if (!isSupabaseConfigured()) return null;
    return movieNightLiveRepository.getById(sessionId);
  },

  async vote(input: {
    sessionId: string;
    movieId: string;
    vote: MovieNightVoteValue;
  }): Promise<MovieNightLiveSession> {
    return movieNightLiveRepository.submitVote(input);
  },

  async myVote(sessionId: string, movieId: string) {
    return movieNightLiveRepository.myVote(sessionId, movieId);
  },

  async completeRoulette(sessionId: string) {
    return movieNightLiveRepository.completeRoulette(sessionId);
  },

  async heartbeat(sessionId: string) {
    if (!isSupabaseConfigured()) return;
    await movieNightLiveRepository.heartbeat(sessionId);
  },

  subscribe(
    sessionId: string,
    onChange: (session: MovieNightLiveSession) => void,
  ) {
    return movieNightLiveRepository.subscribe(sessionId, onChange);
  },
};
