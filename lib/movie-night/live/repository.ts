import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  isMovieNightSessionActive,
  mapMovieNightSessionRow,
  type MovieNightLiveSession,
  type MovieNightVoteValue,
} from "@/lib/movie-night/live/types";

function asRow(data: unknown): Record<string, unknown> | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    const first = data[0];
    return first && typeof first === "object"
      ? (first as Record<string, unknown>)
      : null;
  }
  if (typeof data === "object") return data as Record<string, unknown>;
  return null;
}

export const movieNightLiveRepository = {
  async start(input: {
    crewId: string;
    listId: string;
    movieIds: string[];
  }): Promise<MovieNightLiveSession> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("start_movie_night", {
      p_crew_id: input.crewId,
      p_list_id: input.listId,
      p_movie_ids: input.movieIds,
    });
    if (error) throw new Error(error.message);
    const row = asRow(data);
    if (!row) throw new Error("Could not start Movie Night.");
    return mapMovieNightSessionRow(row);
  },

  async getActive(crewId: string): Promise<MovieNightLiveSession | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("get_active_movie_night", {
      p_crew_id: crewId,
    });
    if (error) throw new Error(error.message);
    const row = asRow(data);
    if (!row) return null;
    const session = mapMovieNightSessionRow(row);
    return isMovieNightSessionActive(session) ? session : null;
  },

  async getById(sessionId: string): Promise<MovieNightLiveSession | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("movie_night_sessions")
      .select("*")
      .eq("id", sessionId)
      .is("deleted_at", null)
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0] as Record<string, unknown> | undefined;
    return row ? mapMovieNightSessionRow(row) : null;
  },

  async submitVote(input: {
    sessionId: string;
    movieId: string;
    vote: MovieNightVoteValue;
  }): Promise<MovieNightLiveSession> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("submit_movie_night_vote", {
      p_session_id: input.sessionId,
      p_movie_id: input.movieId,
      p_vote: input.vote,
    });
    if (error) throw new Error(error.message);
    const row = asRow(data);
    if (!row) throw new Error("Vote failed.");
    return mapMovieNightSessionRow(row);
  },

  async myVote(
    sessionId: string,
    movieId: string,
  ): Promise<MovieNightVoteValue | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("my_movie_night_vote", {
      p_session_id: sessionId,
      p_movie_id: movieId,
    });
    if (error) throw new Error(error.message);
    if (data === "watch" || data === "pass") return data;
    return null;
  },

  async completeRoulette(sessionId: string): Promise<MovieNightLiveSession> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc(
      "complete_movie_night_roulette",
      { p_session_id: sessionId },
    );
    if (error) throw new Error(error.message);
    const row = asRow(data);
    if (!row) throw new Error("Could not complete roulette.");
    return mapMovieNightSessionRow(row);
  },

  async heartbeat(sessionId: string): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    await supabase.rpc("heartbeat_movie_night", {
      p_session_id: sessionId,
    });
  },

  async end(sessionId: string): Promise<MovieNightLiveSession> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase.rpc("end_movie_night", {
      p_session_id: sessionId,
    });
    if (error) throw new Error(error.message);
    const row = asRow(data);
    if (!row) throw new Error("Could not end Movie Night.");
    return mapMovieNightSessionRow(row);
  },

  subscribe(
    sessionId: string,
    onChange: (session: MovieNightLiveSession) => void,
  ): () => void {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`movie-night:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movie_night_sessions",
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = (payload.new ?? null) as Record<string, unknown> | null;
          if (row && row.id) onChange(mapMovieNightSessionRow(row));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  },
};
