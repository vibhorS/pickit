type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-white/[0.06] ${className}`}
    />
  );
}

export function PosterSkeleton({ className = "" }: SkeletonProps) {
  return (
    <Skeleton className={`aspect-[2/3] w-full rounded-xl ${className}`} />
  );
}

export function MovieGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading movies"
      className="grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-12 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-7 lg:gap-y-14"
    >
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex flex-col gap-3">
          <PosterSkeleton />
          <Skeleton className="h-3.5 w-[80%]" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function SearchResultSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Searching" className="space-y-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="flex gap-4 rounded-xl bg-black/20 p-3 sm:p-4"
        >
          <Skeleton className="h-28 w-20 shrink-0 rounded-lg sm:h-32 sm:w-24" />
          <div className="min-w-0 flex-1 space-y-3 py-1">
            <Skeleton className="h-4 w-[66%]" />
            <Skeleton className="h-3 w-[33%]" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-[83%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function MovieDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading movie" className="mx-auto w-full max-w-3xl space-y-6">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="aspect-[2/3] w-full rounded-2xl sm:aspect-[16/9]" />
      <div className="space-y-3 px-1">
      <Skeleton className="h-8 w-[75%]" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}
