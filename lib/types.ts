// ======================
// Movie
// ======================

export type Movie = {
  id: string;
  title: string;
  year: number;
  runtime: number;
  rating: number;
  genres: string[];
  overview: string;
  posterUrl: string;
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
// Collection
// ======================

export type Collection = {
  id: string;
  name: string;
  emoji: string;
  shared: boolean;
  movieIds: string[];
};

// ======================
// Movie Vote
// ======================

export type VoteValue = "like" | "pass";

export type MovieVote = {
  movieId: string;
  vote: VoteValue;
  votedAt: Date;
};