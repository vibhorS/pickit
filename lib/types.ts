// ======================
// Movie
// ======================

export type MediaType = "movie" | "tv" | "documentary" | "youtube";

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  rating: number;
  genres: string[];
  overview: string;
  posterUrl: string;
  /** Content kind. Only "movie" is used in the UI today. */
  mediaType: MediaType;
};

// ======================
// User
// ======================

export type User = {
  id: string;
  name: string;
};

// ======================
// Room
// ======================

export type Room = {
  id: string;
  users: User[];
};

// ======================
// Bucket
// ======================

export type BucketItem = {
  movie: Movie;
  addedBy: string;
  addedAt: Date;
};

// ======================
// Recommendation source
// ======================
// Incremental step toward collections storing Recommendations
// (movie + discovery context). Keep Movie unchanged for now.

export type RecommendationSource = {
  type: string;
  label: string;
};

export type RecommendationMetadata = {
  sourcePlatform?: string;
  sourceUrl?: string;
  recommendedBy?: string;
  savedAt?: string;
  notes?: string;
  captureMethod?: string;
};

export type CollectionItem = {
  movieId: string;
  source: RecommendationSource;
  metadata?: RecommendationMetadata;
};

// ======================
// Collection
// ======================

export type Collection = {
  id: string;
  name: string;
  emoji: string;
  description?: string;
  shared: boolean;
  items: CollectionItem[];
};

// ======================
// Movie Vote
// ======================

export type VoteValue = "like" | "pass";

export type MovieVote = {
  collectionId: string;
  movieId: string;
  userId: string;
  vote: VoteValue;
  votedAt: Date;
};