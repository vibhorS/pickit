import { create } from "zustand";
import type { Movie } from "@/lib/types";

type BucketStore = {
  bucket: Movie[];
  addMovie: (movie: Movie) => void;
  removeMovie: (id: string) => void;
  clearBucket: () => void;
};

export const useBucketStore = create<BucketStore>((set) => ({
  bucket: [],

  addMovie: (movie) =>
    set((state) => {
      if (state.bucket.some((m) => m.id === movie.id)) {
        return state;
      }
      return { bucket: [...state.bucket, movie] };
    }),

  removeMovie: (id) =>
    set((state) => ({
      bucket: state.bucket.filter((movie) => movie.id !== id),
    })),

  clearBucket: () => set({ bucket: [] }),
}));
