export default function Loading() {
  return (
    <div
      className="mx-auto w-full max-w-3xl animate-pulse px-4 py-12 sm:px-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-3 w-24 rounded bg-white/10" />
      <div className="mt-4 h-10 w-2/3 max-w-md rounded-lg bg-white/10" />
      <div className="mt-3 h-4 w-full max-w-lg rounded bg-white/5" />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-36 rounded-2xl bg-netflix-surface"
          />
        ))}
      </div>
    </div>
  );
}
