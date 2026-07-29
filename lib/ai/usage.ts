import { logger } from "@/lib/observability/logger";
import type { AIUsageEvent } from "@/lib/ai/types";

export type AIUsageSink = (event: AIUsageEvent) => void;

const memoryLog: AIUsageEvent[] = [];
const MAX_MEMORY = 200;

let extraSink: AIUsageSink | null = null;

/** Register a sink for future cost dashboards / billing exporters. */
export function setAIUsageSink(sink: AIUsageSink | null): void {
  extraSink = sink;
}

/** In-memory ring buffer — useful for tests and local inspection. */
export function getRecentAIUsage(limit = 50): AIUsageEvent[] {
  return memoryLog.slice(-limit);
}

export function clearAIUsageLog(): void {
  memoryLog.length = 0;
}

export function recordAIUsage(event: AIUsageEvent): void {
  memoryLog.push(event);
  if (memoryLog.length > MAX_MEMORY) {
    memoryLog.splice(0, memoryLog.length - MAX_MEMORY);
  }

  logger.info("AI usage", {
    provider: event.provider,
    model: event.model,
    promptTokens: event.usage.promptTokens,
    completionTokens: event.usage.completionTokens,
    totalTokens: event.usage.totalTokens,
    latencyMs: event.latencyMs,
    operation: event.operation,
    ok: event.ok,
    errorCode: event.errorCode,
    requestId: event.requestId,
  });

  extraSink?.(event);
}
