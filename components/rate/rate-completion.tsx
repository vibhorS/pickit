import Link from "next/link";

type RateCompletionProps = {
  collectionId: string;
  collectionName: string;
};

export function RateCompletion({
  collectionId,
  collectionName,
}: RateCompletionProps) {
  return (
    <section className="mx-auto flex w-full max-w-lg flex-col items-center rounded-2xl border border-white/5 bg-netflix-surface px-6 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.45)] sm:px-10 sm:py-16">
      <p aria-hidden="true" className="text-5xl">
        🎉
      </p>
      <h2 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl">
        You&apos;re all caught up!
      </h2>
      <p className="mt-3 max-w-sm text-sm leading-relaxed text-netflix-muted sm:text-base">
        You&apos;ve rated every movie in {collectionName}.
      </p>
      <Link
        href={`/collection/${collectionId}`}
        className="mt-8 inline-flex rounded-xl bg-netflix-red px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-netflix-red-hover"
      >
        Back to Collection
      </Link>
    </section>
  );
}
