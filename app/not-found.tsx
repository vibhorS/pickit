import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
        404
      </p>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
        This page isn&apos;t on the list
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-netflix-muted">
        The link may be broken, or the list may have been removed. Let&apos;s get
        you back to Movie Night.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className="btn-primary">
          Go home
        </Link>
        <Link href="/collections" className="btn-secondary">
          Browse lists
        </Link>
      </div>
    </main>
  );
}
