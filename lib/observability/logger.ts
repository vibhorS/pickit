/**
 * Production logging abstraction.
 * Swap ConsoleLogger for Sentry / LogRocket adapters without touching call sites.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function createConsoleLogger(minLevel: LogLevel = "debug"): Logger {
  const min = LEVEL_ORDER[minLevel];

  function emit(
    level: LogLevel,
    message: string,
    context?: LogContext,
  ): void {
    if (LEVEL_ORDER[level] < min) return;
    const payload = context ? [`[PickIt] ${message}`, context] : [`[PickIt] ${message}`];
    if (level === "error") console.error(...payload);
    else if (level === "warn") console.warn(...payload);
    else if (level === "info") console.info(...payload);
    else console.debug(...payload);
  }

  return {
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
  };
}

/** Future: export createSentryLogger / createLogRocketLogger here. */
let activeLogger: Logger =
  process.env.NODE_ENV === "production"
    ? createConsoleLogger("warn")
    : createConsoleLogger("debug");

export function setLogger(logger: Logger): void {
  activeLogger = logger;
}

export const logger: Logger = {
  debug: (message, context) => activeLogger.debug(message, context),
  info: (message, context) => activeLogger.info(message, context),
  warn: (message, context) => activeLogger.warn(message, context),
  error: (message, context) => activeLogger.error(message, context),
};
