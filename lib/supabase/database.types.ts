/**
 * Minimal Database typing for PickIt Phase 2A.
 * Expand with generated types via `supabase gen types` when connected.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          display_name: string;
          email: string | null;
          avatar_url: string | null;
          color: string;
          provider: string;
          is_guest: boolean;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["users"]["Row"]> & {
          id: string;
          display_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["users"]["Row"]>;
      };
      movies: {
        Row: {
          id: string;
          title: string;
          year: number | null;
          runtime: number | null;
          rating: number | null;
          genres: string[];
          overview: string;
          poster_url: string;
          media_type: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["movies"]["Row"]> & {
          id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["movies"]["Row"]>;
      };
      lists: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          emoji: string;
          description: string | null;
          archived_at: string | null;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["lists"]["Row"]> & {
          id: string;
          owner_id: string;
          name: string;
          created_by: string;
          updated_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["lists"]["Row"]>;
      };
      recommendations: {
        Row: {
          id: string;
          list_id: string;
          movie_id: string;
          source_id: string | null;
          source_type: string | null;
          source_label: string | null;
          metadata: Json;
          note: string | null;
          added_by_user_id: string;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<
          Database["public"]["Tables"]["recommendations"]["Row"]
        > & {
          list_id: string;
          movie_id: string;
          added_by_user_id: string;
          created_by: string;
          updated_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["recommendations"]["Row"]>;
      };
      ratings: {
        Row: {
          id: string;
          list_id: string;
          movie_id: string;
          user_id: string;
          vote: "like" | "pass";
          voted_at: string;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["ratings"]["Row"]> & {
          list_id: string;
          movie_id: string;
          user_id: string;
          vote: "like" | "pass";
          created_by: string;
          updated_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["ratings"]["Row"]>;
      };
      preferences: {
        Row: {
          user_id: string;
          appearance: string;
          analytics_opt_in: boolean;
          developer_mode: boolean;
          extras: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["preferences"]["Row"]> & {
          user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["preferences"]["Row"]>;
      };
      movie_nights: {
        Row: {
          id: string;
          owner_id: string;
          list_id: string | null;
          status: string;
          winner_movie_id: string | null;
          game_id: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["movie_nights"]["Row"]> & {
          owner_id: string;
          created_by: string;
          updated_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["movie_nights"]["Row"]>;
      };
      data_migrations: {
        Row: {
          id: string;
          user_id: string;
          completed_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          completed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["data_migrations"]["Row"]>;
      };
      recommendation_sources: {
        Row: {
          id: string;
          type: string;
          label: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          label: string;
          created_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["recommendation_sources"]["Row"]
        >;
      };
    };
  };
};
