import { createCrewRepository } from "@/lib/repositories/cloud/crew-repository";
import {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type { Movie, UserProfile } from "@/lib/types";
import { userToProfile } from "@/lib/types";
import { AuthError } from "@/lib/auth/auth-service";
import { getPasswordResetRedirectUrl } from "@/lib/auth/password-reset";
import { logger } from "@/lib/observability/logger";
import type {
  AuthRepository,
  CloudList,
  CloudPreferences,
  CloudRating,
  CloudRecommendation,
  CloudRepositories,
  ListRepository,
  MigrationRepository,
  MovieRepository,
  PreferencesRepository,
  RatingRepository,
  RecommendationRepository,
} from "@/lib/repositories/cloud/types";

function mapUser(row: {
  id: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  color: string;
  provider: string;
  is_guest: boolean;
  created_at: string;
  updated_at: string;
}): UserProfile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    color: row.color,
    provider: (row.provider as UserProfile["provider"]) || "email",
    isGuest: row.is_guest,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapList(row: {
  id: string;
  owner_id: string;
  crew_id?: string | null;
  name: string;
  emoji: string;
  description: string | null;
  archived_at: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): CloudList {
  return {
    id: row.id,
    ownerId: row.owner_id,
    crewId: row.crew_id ?? null,
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    archivedAt: row.archived_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapRecommendation(row: {
  id: string;
  list_id: string;
  movie_id: string;
  source_type: string | null;
  source_label: string | null;
  metadata: unknown;
  note: string | null;
  added_by_user_id: string;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}): CloudRecommendation {
  return {
    id: row.id,
    listId: row.list_id,
    movieId: row.movie_id,
    sourceType: row.source_type,
    sourceLabel: row.source_label,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    note: row.note,
    addedByUserId: row.added_by_user_id,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapRating(row: {
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
}): CloudRating {
  return {
    id: row.id,
    listId: row.list_id,
    movieId: row.movie_id,
    userId: row.user_id,
    vote: row.vote,
    votedAt: row.voted_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createAuthRepository(): AuthRepository {
  async function fetchProfileByUserId(
    userId: string,
  ): Promise<UserProfile | null> {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      logger.error("Failed to load profile", { message: error.message });
      throw new AuthError("UNKNOWN", error.message);
    }
    return data ? mapUser(data) : null;
  }

  /**
   * Upsert app profile after auth, then read it back.
   * Retries briefly so the signup trigger can finish first.
   */
  async function ensureAppProfile(input: {
    userId: string;
    displayName: string;
    email: string | null;
    provider: UserProfile["provider"];
    isGuest: boolean;
  }): Promise<UserProfile> {
    const supabase = getSupabaseBrowserClient();
    const { data: upserted, error: upsertError } = await supabase
      .from("users")
      .upsert({
        id: input.userId,
        display_name: input.displayName,
        email: input.email,
        provider: input.provider,
        is_guest: input.isGuest,
      })
      .select("*")
      .maybeSingle();

    if (upserted) return mapUser(upserted);

    if (upsertError) {
      logger.warn("Profile upsert failed; waiting for trigger", {
        message: upsertError.message,
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await fetchProfileByUserId(input.userId);
      if (existing) return existing;
      await delay(150 * (attempt + 1));
    }

    throw new AuthError(
      "UNKNOWN",
      upsertError?.message ??
        "Profile missing after signup. Confirm the Phase 2A/2B migrations are applied, then try again.",
    );
  }

  async function ensureSessionAfterSignup(input: {
    email: string;
    password: string;
    session: {
      access_token: string;
      refresh_token: string;
    } | null;
  }): Promise<void> {
    const supabase = getSupabaseBrowserClient();
    if (input.session) {
      await supabase.auth.setSession({
        access_token: input.session.access_token,
        refresh_token: input.session.refresh_token,
      });
      return;
    }

    // Email confirmation off usually returns a session; if not, sign in now.
    const { data, error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });
    if (data.session) return;

    const message = (error?.message ?? "").toLowerCase();
    if (
      message.includes("confirm") ||
      message.includes("email not confirmed")
    ) {
      throw new AuthError(
        "UNKNOWN",
        "Confirm your email, then sign in. For local development, disable email confirmation in Supabase → Authentication → Providers → Email.",
      );
    }

    throw new AuthError(
      "UNKNOWN",
      "No active session after signup. Confirm your email, or disable email confirmation in Supabase Auth for local development.",
    );
  }

  return {
    async getSession() {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw new AuthError("UNKNOWN", error.message);
      if (!data.session) return null;
      return {
        userId: data.session.user.id,
        accessToken: data.session.access_token,
      };
    },

    async getProfile() {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return null;
      return fetchProfileByUserId(userId);
    },

    async signUpWithEmail({ email, password, displayName }) {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      const trimmedName = displayName.trim() || "PickIt User";
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            display_name: trimmedName,
            provider: "email",
            is_guest: false,
          },
        },
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (message.includes("already")) {
          throw new AuthError(
            "EMAIL_IN_USE",
            "An account with this email exists.",
          );
        }
        if (message.includes("password")) {
          throw new AuthError("WEAK_PASSWORD", error.message);
        }
        if (
          message.includes("rate limit") ||
          message.includes("over_email_send_rate_limit") ||
          message.includes("email rate") ||
          error.status === 429
        ) {
          throw new AuthError(
            "RATE_LIMITED",
            "Supabase email rate limit hit. For local development: Authentication → Providers → Email → turn off Confirm email, wait a minute, then sign up with a new address (or sign in if the account already exists).",
          );
        }
        throw new AuthError("UNKNOWN", error.message);
      }
      if (!data.user) throw new AuthError("UNKNOWN", "Sign up failed.");

      // Duplicate email soft-response when confirm-email is enabled.
      if (
        Array.isArray(data.user.identities) &&
        data.user.identities.length === 0
      ) {
        throw new AuthError(
          "EMAIL_IN_USE",
          "An account with this email exists. Sign in instead.",
        );
      }

      await ensureSessionAfterSignup({
        email: normalizedEmail,
        password,
        session: data.session,
      });

      return ensureAppProfile({
        userId: data.user.id,
        displayName: trimmedName,
        email: normalizedEmail,
        provider: "email",
        isGuest: false,
      });
    },

    async signInWithEmail({ email, password }) {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        const message = error.message.toLowerCase();
        if (
          message.includes("confirm") ||
          message.includes("email not confirmed")
        ) {
          throw new AuthError(
            "UNKNOWN",
            "Confirm your email, then sign in. For local development, disable email confirmation in Supabase → Authentication → Providers → Email.",
          );
        }
        throw new AuthError(
          "INVALID_CREDENTIALS",
          "Incorrect email or password.",
        );
      }
      if (!data.user) {
        throw new AuthError(
          "INVALID_CREDENTIALS",
          "Incorrect email or password.",
        );
      }

      const metaName =
        (data.user.user_metadata?.display_name as string | undefined)?.trim() ||
        normalizedEmail.split("@")[0] ||
        "PickIt User";

      return ensureAppProfile({
        userId: data.user.id,
        displayName: metaName,
        email: normalizedEmail,
        provider: "email",
        isGuest: false,
      });
    },

    async continueAsGuest(displayName = "Guest") {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: displayName,
            provider: "guest",
            is_guest: true,
          },
        },
      });
      if (error) {
        throw new AuthError(
          "PROVIDER_UNAVAILABLE",
          "Guest mode requires anonymous sign-in enabled in Supabase Auth settings.",
        );
      }
      if (!data.user) throw new AuthError("UNKNOWN", "Guest sign-in failed.");
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      return ensureAppProfile({
        userId: data.user.id,
        displayName,
        email: null,
        provider: "guest",
        isGuest: true,
      });
    },

    async signInWithGoogle() {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) {
        throw new AuthError(
          "PROVIDER_UNAVAILABLE",
          "Google Sign-In is not enabled for this project yet.",
        );
      }
    },

    async signInWithApple() {
      throw new AuthError(
        "PROVIDER_UNAVAILABLE",
        "Apple Sign-In is reserved for a future IdP configuration.",
      );
    },

    async resetPasswordForEmail(email) {
      const supabase = getSupabaseBrowserClient();
      const normalizedEmail = email.trim().toLowerCase();
      let redirectTo: string;
      try {
        redirectTo = getPasswordResetRedirectUrl();
      } catch {
        throw new AuthError(
          "UNKNOWN",
          "Could not determine the app URL for password reset. Try again from the browser.",
        );
      }
      logger.info("Password reset redirect configured", {
        origin: new URL(redirectTo).origin,
        path: new URL(redirectTo).pathname,
      });
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        { redirectTo },
      );
      if (!error) return;

      const message = error.message.toLowerCase();
      if (
        message.includes("rate limit") ||
        message.includes("over_email_send_rate_limit") ||
        message.includes("email rate") ||
        error.status === 429
      ) {
        throw new AuthError(
          "RATE_LIMITED",
          "Too many reset attempts right now. Please wait a moment and try again.",
        );
      }
      if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("failed to fetch")
      ) {
        throw new AuthError(
          "NETWORK",
          "We couldn't reach the server. Check your connection and try again.",
        );
      }
      // Do not reveal whether the email exists — treat other errors as success.
      logger.error("Password reset request soft-failed", {
        message: error.message.slice(0, 120),
      });
    },

    async updatePassword(password) {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new AuthError(
          "SESSION_EXPIRED",
          "This reset link is invalid or has expired. Request a new one.",
        );
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (!error) return;

      const message = error.message.toLowerCase();
      if (
        message.includes("session") ||
        message.includes("expired") ||
        message.includes("invalid") ||
        message.includes("not authenticated")
      ) {
        throw new AuthError(
          "SESSION_EXPIRED",
          "This reset link is invalid or has expired. Request a new one.",
        );
      }
      if (message.includes("same") || message.includes("different")) {
        throw new AuthError(
          "WEAK_PASSWORD",
          "Choose a new password that is different from your current one.",
        );
      }
      if (message.includes("password") || message.includes("weak")) {
        throw new AuthError(
          "WEAK_PASSWORD",
          "Your password needs to be at least 8 characters.",
        );
      }
      if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("failed to fetch")
      ) {
        throw new AuthError(
          "NETWORK",
          "We couldn't reach the server. Check your connection and try again.",
        );
      }
      throw new AuthError(
        "UNKNOWN",
        "We couldn't update your password. Please try again.",
      );
    },

    async exchangeCodeForSession(code) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return;

      const message = error.message.toLowerCase();
      if (
        message.includes("expired") ||
        message.includes("invalid") ||
        message.includes("code verifier") ||
        message.includes("already") ||
        message.includes("flow state")
      ) {
        throw new AuthError(
          "SESSION_EXPIRED",
          "This reset link is invalid or has expired. Request a new one.",
        );
      }
      if (
        message.includes("network") ||
        message.includes("fetch") ||
        message.includes("failed to fetch")
      ) {
        throw new AuthError(
          "NETWORK",
          "We couldn't reach the server. Check your connection and try again.",
        );
      }
      throw new AuthError(
        "UNKNOWN",
        "We couldn't verify your reset link. Please try again.",
      );
    },

    async updateProfile(userId, patch) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("users")
        .update({
          display_name: patch.displayName,
          avatar_url: patch.avatarUrl,
          color: patch.color,
          email: patch.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId)
        .select("*")
        .single();
      if (error || !data) {
        throw new AuthError("UNKNOWN", error?.message ?? "Update failed.");
      }
      return mapUser(data);
    },

    async logout() {
      const supabase = getSupabaseBrowserClient();
      await supabase.auth.signOut();
    },

    async deleteAccount(userId) {
      const supabase = getSupabaseBrowserClient();
      await supabase
        .from("users")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", userId);
      // Soft-delete owned lists
      await supabase
        .from("lists")
        .update({ deleted_at: new Date().toISOString() })
        .eq("owner_id", userId);
      await supabase.auth.signOut();
      // Hard delete requires service role / Edge Function — documented for ops.
      logger.info("Account soft-deleted; schedule hard delete via admin job", {
        userId,
      });
    },

    onAuthStateChange(callback) {
      const supabase = getSupabaseBrowserClient();
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!session?.user) {
          callback(null, event);
          return;
        }
        try {
          const profile = await fetchProfileByUserId(session.user.id);
          callback(
            profile ??
              userToProfile({
                id: session.user.id,
                name:
                  session.user.user_metadata?.display_name ??
                  session.user.email ??
                  "User",
              }),
            event,
          );
        } catch {
          callback(
            userToProfile({
              id: session.user.id,
              name:
                session.user.user_metadata?.display_name ??
                session.user.email ??
                "User",
            }),
            event,
          );
        }
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

function createMovieRepository(): MovieRepository {
  return {
    async upsert(movie) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("movies").upsert({
        id: movie.id,
        title: movie.title,
        year: movie.year,
        runtime: movie.runtime,
        rating: movie.rating,
        genres: movie.genres,
        overview: movie.overview,
        poster_url: movie.posterUrl,
        media_type: movie.mediaType,
      });
      if (error) throw new Error(error.message);
      return movie;
    },
    async upsertMany(movies) {
      if (movies.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("movies").upsert(
        movies.map((movie) => ({
          id: movie.id,
          title: movie.title,
          year: movie.year,
          runtime: movie.runtime,
          rating: movie.rating,
          genres: movie.genres,
          overview: movie.overview,
          poster_url: movie.posterUrl,
          media_type: movie.mediaType,
        })),
      );
      if (error) throw new Error(error.message);
      return movies;
    },
    async getById(id) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("movies")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        id: data.id,
        title: data.title,
        year: data.year ?? 0,
        runtime: data.runtime ?? 0,
        rating: Number(data.rating ?? 0),
        genres: data.genres ?? [],
        overview: data.overview ?? "",
        posterUrl: data.poster_url ?? "",
        mediaType: (data.media_type as Movie["mediaType"]) ?? "movie",
      };
    },
    async getByIds(ids) {
      if (ids.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("movies")
        .select("*")
        .in("id", ids);
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        year: row.year ?? 0,
        runtime: row.runtime ?? 0,
        rating: Number(row.rating ?? 0),
        genres: row.genres ?? [],
        overview: row.overview ?? "",
        posterUrl: row.poster_url ?? "",
        mediaType: (row.media_type as Movie["mediaType"]) ?? "movie",
      }));
    },
  };
}

function createListRepository(): ListRepository {
  return {
    async listForOwner(ownerId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("owner_id", ownerId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapList);
    },
    async listForCrew(crewId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("crew_id", crewId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapList);
    },
    async getById(id) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("id", id)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapList(data) : null;
    },
    async upsert(list) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("lists")
        .upsert({
          id: list.id,
          owner_id: list.ownerId,
          crew_id: list.crewId ?? null,
          name: list.name,
          emoji: list.emoji,
          description: list.description ?? null,
          archived_at: list.archivedAt ?? null,
          created_by: list.createdBy,
          updated_by: list.updatedBy,
          created_at: list.createdAt,
          updated_at: list.updatedAt,
          deleted_at: list.deletedAt ?? null,
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "List upsert failed");
      return mapList(data);
    },
    async softDelete(id, userId) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("lists")
        .update({
          deleted_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("id", id);
      if (error) throw new Error(error.message);
      void userId;
    },
    subscribe(ownerId, onChange) {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`lists:${ownerId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
            filter: `owner_id=eq.${ownerId}`,
          },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
    subscribeCrew(crewId, onChange) {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`lists-crew:${crewId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "lists",
            filter: `crew_id=eq.${crewId}`,
          },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}

function createRecommendationRepository(): RecommendationRepository {
  return {
    async listForOwner(ownerId) {
      const lists = await createListRepository().listForOwner(ownerId);
      return this.listForListIds(lists.map((list) => list.id));
    },
    async listForListIds(listIds) {
      if (listIds.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("recommendations")
        .select("*")
        .in("list_id", listIds)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRecommendation);
    },
    async listForList(listId) {
      return this.listForListIds([listId]);
    },
    async upsert(item) {
      // Invalid IDs must fail loudly rather than be silently rewritten.
      if (!UUID_PATTERN.test(item.id)) {
        throw new Error(
          `Invalid recommendation id (expected UUID): ${item.id}`,
        );
      }

      const insertPayload = {
        id: item.id,
        list_id: item.listId,
        movie_id: item.movieId,
        source_type: item.sourceType ?? null,
        source_label: item.sourceLabel ?? null,
        metadata: item.metadata ?? {},
        note: item.note ?? null,
        added_by_user_id: item.addedByUserId,
        created_by: item.createdBy,
        updated_by: item.updatedBy,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
        deleted_at: item.deletedAt ?? null,
      };

      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("recommendations")
        .upsert(insertPayload, { onConflict: "list_id,movie_id" })
        .select("*")
        .single();

      if (error || !data) {
        throw new Error(error?.message ?? "Recommendation upsert failed");
      }
      return mapRecommendation(data);
    },
    async softDelete(listId, movieId, userId) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("recommendations")
        .update({
          deleted_at: new Date().toISOString(),
          updated_by: userId,
        })
        .eq("list_id", listId)
        .eq("movie_id", movieId);
      if (error) throw new Error(error.message);
    },
    subscribe(ownerId, onChange) {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`recommendations:${ownerId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "recommendations" },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}

function createRatingRepository(): RatingRepository {
  return {
    async listForUser(userId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRating);
    },
    async listForListIds(listIds) {
      if (listIds.length === 0) return [];
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ratings")
        .select("*")
        .in("list_id", listIds)
        .is("deleted_at", null);
      if (error) throw new Error(error.message);
      return (data ?? []).map(mapRating);
    },
    async upsert(rating) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("ratings")
        .upsert(
          {
            list_id: rating.listId,
            movie_id: rating.movieId,
            user_id: rating.userId,
            vote: rating.vote,
            voted_at: rating.votedAt,
            created_by: rating.createdBy,
            updated_by: rating.updatedBy,
            created_at: rating.createdAt,
            updated_at: rating.updatedAt,
            deleted_at: rating.deletedAt ?? null,
          },
          { onConflict: "list_id,movie_id,user_id" },
        )
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Rating upsert failed");
      return mapRating(data);
    },
    async remove(listId, movieId, userId) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("ratings")
        .update({ deleted_at: new Date().toISOString() })
        .eq("list_id", listId)
        .eq("movie_id", movieId)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
    },
    subscribe(userId, onChange) {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`ratings:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ratings",
          },
          () => onChange(),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },
  };
}

function createPreferencesRepository(): PreferencesRepository {
  return {
    async get(userId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("preferences")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        userId: data.user_id,
        appearance: (data.appearance as CloudPreferences["appearance"]) || "dark",
        analyticsOptIn: data.analytics_opt_in,
        developerMode: data.developer_mode,
        extras: (data.extras as Record<string, unknown>) ?? {},
        updatedAt: data.updated_at,
      };
    },
    async upsert(prefs) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("preferences")
        .upsert({
          user_id: prefs.userId,
          appearance: prefs.appearance,
          analytics_opt_in: prefs.analyticsOptIn,
          developer_mode: prefs.developerMode,
          extras: prefs.extras,
          updated_at: prefs.updatedAt,
        })
        .select("*")
        .single();
      if (error || !data) {
        throw new Error(error?.message ?? "Preferences upsert failed");
      }
      return {
        userId: data.user_id,
        appearance: (data.appearance as CloudPreferences["appearance"]) || "dark",
        analyticsOptIn: data.analytics_opt_in,
        developerMode: data.developer_mode,
        extras: (data.extras as Record<string, unknown>) ?? {},
        updatedAt: data.updated_at,
      };
    },
  };
}

function createMigrationRepository(): MigrationRepository {
  return {
    async hasCompleted(userId, migrationId) {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("data_migrations")
        .select("id")
        .eq("id", migrationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return Boolean(data);
    },
    async markCompleted(userId, migrationId) {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("data_migrations").upsert({
        id: migrationId,
        user_id: userId,
        completed_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
    },
  };
}

let cached: CloudRepositories | null = null;

export function getCloudRepositories(): CloudRepositories {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured.");
  }
  if (!cached) {
    cached = {
      auth: createAuthRepository(),
      movies: createMovieRepository(),
      lists: createListRepository(),
      recommendations: createRecommendationRepository(),
      ratings: createRatingRepository(),
      preferences: createPreferencesRepository(),
      migrations: createMigrationRepository(),
      crew: createCrewRepository(),
    };
  }
  return cached;
}
