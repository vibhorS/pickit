"use client";

import { motion } from "framer-motion";
import {
  Archive,
  Search,
  Trash2,
  ArrowRight,
} from "lucide-react";
import type { ReactNode } from "react";
import type { CaptureItem, CaptureProcessingStatus } from "@/lib/capture/intelligence/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/motion";

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusTone(
  status: CaptureProcessingStatus,
): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "ready") return "success";
  if (status === "failed") return "danger";
  if (status === "imported") return "accent";
  if (status === "archived") return "neutral";
  return "warning";
}

function statusLabel(status: CaptureProcessingStatus): string {
  switch (status) {
    case "checking-duplicates":
      return "Checking";
    case "preparing":
      return "Organizing";
    case "understanding":
      return "Understanding";
    case "matching":
      return "Matching";
    case "reading":
      return "Reading";
    case "queued":
      return "New";
    case "ready":
      return "Ready";
    case "imported":
      return "Saved";
    case "archived":
      return "Archived";
    case "failed":
      return "Needs a retry";
    default:
      return "Capture";
  }
}

type CaptureInboxProps = {
  items: CaptureItem[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  onOpen: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  emptyState?: ReactNode;
};

export function CaptureInbox({
  items,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onOpen,
  onArchive,
  onDelete,
  emptyState,
}: CaptureInboxProps) {
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-netflix-red">
            Inbox
          </p>
          <h2 className="mt-1 text-xl font-bold text-white">
            Recommendation captures
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "inbox", label: "Active" },
              { id: "imported", label: "Imported" },
              { id: "archived", label: "Archived" },
              { id: "all", label: "All" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onStatusFilterChange(filter.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                statusFilter === filter.id
                  ? "bg-white text-black"
                  : "bg-white/[0.06] text-netflix-muted hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-netflix-muted" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search captures, themes, titles…"
          className="w-full rounded-2xl border border-white/10 bg-white/[0.04] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-netflix-muted/70 focus:border-white/20"
        />
      </div>

      {items.length === 0 ? (
        emptyState ?? (
          <p className="mt-8 text-sm text-netflix-muted">
            No captures here yet. Drop a screenshot above.
          </p>
        )
      ) : (
        <motion.ul
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mt-6 grid gap-3 sm:grid-cols-2"
        >
          {items.map((item) => (
            <motion.li
              key={item.id}
              variants={staggerItem}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] transition hover:border-white/20 hover:bg-white/[0.05]"
            >
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="flex w-full gap-3 p-3 text-left"
              >
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-netflix-elevated">
                  {item.thumbnailDataUrl || item.imageDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.thumbnailDataUrl || item.imageDataUrl || ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-netflix-muted">
                      {item.mediaKind}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={statusTone(item.status)}>
                      {statusLabel(item.status)}
                    </Badge>
                    {item.theme ? (
                      <Badge tone="accent">{item.theme}</Badge>
                    ) : null}
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-white">
                    {item.headline || item.source.label || "Untitled capture"}
                  </p>
                  <p className="mt-1 text-xs text-netflix-muted">
                    {item.source.label}
                    {" · "}
                    {formatWhen(item.createdAt)}
                    {item.detectedCount > 0
                      ? ` · ${item.detectedCount} found`
                      : ""}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-netflix-muted opacity-0 transition group-hover:opacity-100" />
              </button>
              <div className="flex justify-end gap-1 border-t border-white/5 px-2 py-1.5">
                {item.status !== "archived" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-netflix-muted"
                    onClick={() => onArchive(item.id)}
                  >
                    <Archive className="mr-1.5 h-3.5 w-3.5" />
                    Archive
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-300/80"
                  onClick={() => onDelete(item.id)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </section>
  );
}
