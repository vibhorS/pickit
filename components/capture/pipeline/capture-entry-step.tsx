"use client";

import Link from "next/link";
import { ClipboardPaste, FileText, Link2, List, Sparkles } from "lucide-react";
import { useState } from "react";
import type {
  CaptureInputKind,
  ManualCaptureInput,
} from "@/lib/capture/types";

type CaptureEntryStepProps = {
  busy: boolean;
  error: string | null;
  onSubmit: (input: ManualCaptureInput) => void;
};

const INPUT_OPTIONS: {
  kind: CaptureInputKind;
  label: string;
  icon: typeof Link2;
  placeholder: string;
}[] = [
  {
    kind: "link",
    label: "Paste Link",
    icon: Link2,
    placeholder: "https://instagram.com/reel/…",
  },
  {
    kind: "text",
    label: "Paste Text",
    icon: FileText,
    placeholder: "Paste a post, message, caption, or recommendation…",
  },
  {
    kind: "movie-list",
    label: "Paste Movie List",
    icon: List,
    placeholder: "One movie per line\nArrival\nKnives Out\nPast Lives",
  },
];

export function CaptureEntryStep({
  busy,
  error,
  onSubmit,
}: CaptureEntryStepProps) {
  const [kind, setKind] = useState<CaptureInputKind>("link");
  const [content, setContent] = useState("");
  const active =
    INPUT_OPTIONS.find((option) => option.kind === kind) ?? INPUT_OPTIONS[0];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Link href="/" prefetch className="btn-ghost -ml-3 inline-flex">
        ← Home
      </Link>

      <div className="mt-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-netflix-red">
          Capture
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-white sm:text-5xl">
          Save the recommendation.
          <span className="block text-netflix-muted">Decide later.</span>
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-netflix-muted">
          Eventually you&apos;ll be able to share directly from Instagram,
          Reddit, YouTube and more. This flow simulates that experience.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2">
        {INPUT_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = kind === option.kind;
          return (
            <button
              key={option.kind}
              type="button"
              onClick={() => setKind(option.kind)}
              className={`flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl px-2 text-center text-xs font-semibold transition sm:text-sm ${
                selected
                  ? "bg-netflix-red/15 text-white ring-1 ring-netflix-red/60"
                  : "bg-white/[0.04] text-netflix-muted hover:bg-white/[0.07] hover:text-white"
              }`}
            >
              <Icon className="size-5" strokeWidth={1.8} aria-hidden="true" />
              {option.label}
            </button>
          );
        })}
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ kind, content });
        }}
      >
        <label className="sr-only" htmlFor="capture-content">
          {active.label}
        </label>
        <div className="relative">
          <ClipboardPaste
            className="pointer-events-none absolute left-4 top-4 size-4 text-netflix-muted"
            strokeWidth={1.8}
            aria-hidden="true"
          />
          <textarea
            id="capture-content"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={active.placeholder}
            rows={kind === "movie-list" ? 8 : 6}
            autoFocus
            className="w-full resize-none rounded-2xl bg-white/[0.04] py-4 pl-11 pr-4 text-sm leading-relaxed text-white outline-none placeholder:text-netflix-muted/70 focus:ring-2 focus:ring-netflix-red/60"
          />
        </div>

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !content.trim()}
          className="btn-primary mt-4 w-full gap-2 sm:w-auto"
        >
          <Sparkles className="size-4" strokeWidth={2} aria-hidden="true" />
          {busy ? "Finding movies…" : "Find Movies"}
        </button>
      </form>
    </div>
  );
}
