"use client";

import { useEffect, useState } from "react";
import { useSyncStore, type SyncEvent } from "@/store/sync-store";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import {
  CheckCircle,
  AlertTriangle,
  Cloud,
  CloudOff,
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Clock,
} from "lucide-react";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    idle: { label: "Synced", variant: "default" },
    syncing: { label: "Syncing...", variant: "secondary" },
    offline: { label: "Offline", variant: "outline" },
    error: { label: "Error", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={variant}>{label}</Badge>;
}

function EventRow({ event }: { event: SyncEvent }) {
  const icons: Record<string, React.ReactNode> = {
    write_success: <CheckCircle className="h-3 w-3 text-green-500" />,
    write_failed: <AlertTriangle className="h-3 w-3 text-red-500" />,
    write_retry: <RefreshCw className="h-3 w-3 text-yellow-500" />,
    write_pending: <Clock className="h-3 w-3 text-zinc-400" />,
    realtime_event: <Wifi className="h-3 w-3 text-blue-400" />,
    merge_conflict: <AlertTriangle className="h-3 w-3 text-orange-400" />,
    snapshot_applied: <Database className="h-3 w-3 text-purple-400" />,
  };
  const time = new Date(event.timestamp).toLocaleTimeString();
  return (
    <div className="flex items-start gap-2 text-xs text-zinc-400 py-1 border-b border-zinc-800 last:border-0">
      {icons[event.type] ?? <Cloud className="h-3 w-3" />}
      <div className="flex-1 min-w-0">
        <span className="text-zinc-300">{event.type.replace(/_/g, " ")}</span>
        <span className="mx-1 text-zinc-600">·</span>
        <span className="text-zinc-500">{event.entity}/{event.entityId.slice(0, 8)}</span>
        {event.detail && (
          <p className="text-zinc-600 truncate">{event.detail}</p>
        )}
      </div>
      <span className="text-zinc-600 shrink-0">{time}</span>
    </div>
  );
}

export function SyncDashboard() {
  const store = useSyncStore();
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(timer);
  }, []);

  const stats = [
    { label: "Cloud Status", value: <StatusBadge status={store.status} /> },
    { label: "Repository", value: store.repositoryMode },
    {
      label: "Realtime",
      value: store.realtimeConnected ? (
        <span className="flex items-center gap-1 text-green-400"><Wifi className="h-3 w-3" /> Connected</span>
      ) : (
        <span className="flex items-center gap-1 text-zinc-500"><WifiOff className="h-3 w-3" /> Disconnected</span>
      ),
    },
    { label: "Last Sync", value: store.lastSyncAt ? new Date(store.lastSyncAt).toLocaleTimeString() : "Never" },
    { label: "Pending Writes", value: store.pendingWrites },
    { label: "Successful Writes", value: store.successfulWrites },
    { label: "Failed Writes", value: store.failedWrites },
    { label: "Retries", value: store.retries },
    { label: "Realtime Events", value: store.realtimeEvents },
    { label: "Merge Conflicts", value: store.mergeConflicts },
  ];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-zinc-200">Cloud Sync</h3>

      <Surface className="p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {stats.map((stat) => (
            <div key={stat.label} className="flex justify-between items-center">
              <span className="text-zinc-500">{stat.label}</span>
              <span className="text-zinc-200 font-mono">
                {typeof stat.value === "number" ? String(stat.value) : stat.value}
              </span>
            </div>
          ))}
        </div>
      </Surface>

      <div>
        <h4 className="text-xs font-semibold text-zinc-400 mb-2">Recent Events</h4>
        <Surface className="p-2 max-h-60 overflow-y-auto">
          {store.recentEvents.length === 0 ? (
            <p className="text-xs text-zinc-600 py-2 text-center">No sync events yet</p>
          ) : (
            store.recentEvents.map((event) => (
              <EventRow key={event.id} event={event} />
            ))
          )}
        </Surface>
      </div>
    </div>
  );
}
