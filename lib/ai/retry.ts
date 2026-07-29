import { AIError } from "@/lib/ai/errors";

export type RetryOptions = {
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Base delay in ms for exponential backoff. */
  baseDelayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AIError("ABORTED", "Request aborted", { retryable: false }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AIError("ABORTED", "Request aborted", { retryable: false }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function defaultShouldRetry(error: unknown): boolean {
  if (error instanceof AIError) {
    return error.retryable;
  }
  return false;
}

/**
 * Run an async operation with timeout + exponential backoff retries.
 */
export async function withRetryTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const baseDelayMs = options.baseDelayMs ?? 400;
  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const onParentAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onParentAbort, { once: true });

    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const result = await operation(controller.signal);
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onParentAbort);
      return result;
    } catch (error) {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onParentAbort);

      const normalized =
        options.signal?.aborted
          ? new AIError("ABORTED", "Request aborted", { retryable: false, cause: error })
          : controller.signal.aborted && !(error instanceof AIError && error.code === "ABORTED")
            ? new AIError("TIMEOUT", `AI request timed out after ${timeoutMs}ms`, {
                retryable: true,
                cause: error,
              })
            : error;

      lastError = normalized;

      const canRetry = attempt < retries && shouldRetry(normalized, attempt);
      if (!canRetry) break;

      const delay = baseDelayMs * 2 ** attempt;
      await sleep(delay, options.signal);
    }
  }

  if (lastError instanceof AIError) throw lastError;
  throw new AIError(
    "UNKNOWN",
    lastError instanceof Error ? lastError.message : "AI request failed",
    { retryable: false, cause: lastError },
  );
}
