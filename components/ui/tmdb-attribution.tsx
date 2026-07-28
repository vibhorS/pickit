"use client";

import Link from "next/link";

/** Subtle TMDb attribution for non-immersive chrome. */
export function TmdbAttribution() {
  return (
    <p className="px-4 pb-28 pt-6 text-center text-[0.65rem] leading-relaxed text-white/35 sm:pb-24">
      Movie data from{" "}
      <a
        href="https://www.themoviedb.org/"
        target="_blank"
        rel="noreferrer"
        className="underline-offset-2 hover:text-white/55 hover:underline"
      >
        TMDb
      </a>
      . Not endorsed or certified by TMDb.{" "}
      <Link
        href="/profile"
        className="underline-offset-2 hover:text-white/55 hover:underline"
      >
        About
      </Link>
    </p>
  );
}
