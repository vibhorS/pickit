export type AIErrorCode =
  | "NOT_CONFIGURED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "INVALID_JSON"
  | "PROVIDER_ERROR"
  | "ABORTED"
  | "UNKNOWN";

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly retryable: boolean;
  readonly status?: number;
  readonly cause?: unknown;

  constructor(
    code: AIErrorCode,
    message: string,
    options?: { retryable?: boolean; status?: number; cause?: unknown },
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.status = options?.status;
    this.cause = options?.cause;
  }
}

export function isAIError(error: unknown): error is AIError {
  return error instanceof AIError;
}
