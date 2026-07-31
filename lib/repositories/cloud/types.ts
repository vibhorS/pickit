import type { Movie, MovieVote, UserProfile, VoteValue } from "@/lib/types";
import type { AppearancePreference } from "@/store/settings-store";

export type CloudList = {
  id: string;
  ownerId: string;
  crewId?: string | null;
  name: string;
  emoji: string;
  description?: string | null;
  archivedAt?: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CloudRecommendation = {
  id: string;
  listId: string;
  movieId: string;
  sourceType?: string | null;
  sourceLabel?: string | null;
  metadata?: Record<string, unknown>;
  note?: string | null;
  addedByUserId: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CloudRating = {
  id?: string;
  listId: string;
  movieId: string;
  userId: string;
  vote: VoteValue;
  votedAt: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

export type CloudPreferences = {
  userId: string;
  appearance: AppearancePreference;
  analyticsOptIn: boolean;
  developerMode: boolean;
  extras: Record<string, unknown>;
  updatedAt: string;
};

export type AuthRepository = {
  getSession(): Promise<{ userId: string; accessToken: string } | null>;
  getProfile(): Promise<UserProfile | null>;
  signUpWithEmail(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<UserProfile>;
  signInWithEmail(input: {
    email: string;
    password: string;
  }): Promise<UserProfile>;
  continueAsGuest(displayName?: string): Promise<UserProfile>;
  signInWithGoogle(): Promise<void>;
  signInWithApple(): Promise<void>;
  resetPasswordForEmail(email: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  updateProfile(
    userId: string,
    patch: Partial<
      Pick<UserProfile, "displayName" | "avatarUrl" | "color" | "email">
    >,
  ): Promise<UserProfile>;
  logout(): Promise<void>;
  deleteAccount(userId: string): Promise<void>;
  onAuthStateChange(
    callback: (profile: UserProfile | null, event?: string) => void,
  ): () => void;
};

export type MovieRepository = {
  upsert(movie: Movie): Promise<Movie>;
  upsertMany(movies: Movie[]): Promise<Movie[]>;
  getById(id: string): Promise<Movie | null>;
  getByIds(ids: string[]): Promise<Movie[]>;
};

export type ListRepository = {
  listForOwner(ownerId: string): Promise<CloudList[]>;
  listForCrew(crewId: string): Promise<CloudList[]>;
  getById(id: string): Promise<CloudList | null>;
  upsert(list: CloudList): Promise<CloudList>;
  softDelete(id: string, userId: string): Promise<void>;
  subscribe(ownerId: string, onChange: () => void): () => void;
  subscribeCrew(crewId: string, onChange: () => void): () => void;
};

export type RecommendationRepository = {
  listForOwner(ownerId: string): Promise<CloudRecommendation[]>;
  listForListIds(listIds: string[]): Promise<CloudRecommendation[]>;
  listForList(listId: string): Promise<CloudRecommendation[]>;
  upsert(item: CloudRecommendation): Promise<CloudRecommendation>;
  softDelete(listId: string, movieId: string, userId: string): Promise<void>;
  subscribe(ownerId: string, onChange: () => void): () => void;
};

export type RatingRepository = {
  listForUser(userId: string): Promise<CloudRating[]>;
  listForListIds(listIds: string[]): Promise<CloudRating[]>;
  upsert(rating: CloudRating): Promise<CloudRating>;
  remove(listId: string, movieId: string, userId: string): Promise<void>;
  subscribe(userId: string, onChange: () => void): () => void;
};

export type PreferencesRepository = {
  get(userId: string): Promise<CloudPreferences | null>;
  upsert(prefs: CloudPreferences): Promise<CloudPreferences>;
};

export type MigrationRepository = {
  hasCompleted(userId: string, migrationId: string): Promise<boolean>;
  markCompleted(userId: string, migrationId: string): Promise<void>;
};

export type CloudRepositories = {
  auth: AuthRepository;
  movies: MovieRepository;
  lists: ListRepository;
  recommendations: RecommendationRepository;
  ratings: RatingRepository;
  preferences: PreferencesRepository;
  migrations: MigrationRepository;
  crew: import("@/lib/repositories/cloud/crew-repository").CrewRepository;
};

export function cloudRatingToMovieVote(rating: CloudRating): MovieVote {
  return {
    collectionId: rating.listId,
    movieId: rating.movieId,
    userId: rating.userId,
    vote: rating.vote,
    votedAt: new Date(rating.votedAt),
    createdBy: rating.createdBy,
    updatedBy: rating.updatedBy,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
    deletedAt: rating.deletedAt,
  };
}
