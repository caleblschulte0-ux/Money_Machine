import { redact, type JsonObject, type JsonValue } from "@holdco/core";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export interface LogRecord {
  readonly time: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly context: JsonObject;
}

export interface LogSink {
  write(record: LogRecord): void;
}

export const consoleSink: LogSink = {
  write(record) {
    const line = JSON.stringify(record);
    if (record.level === "error") process.stderr.write(line + "\n");
    else process.stdout.write(line + "\n");
  },
};

/** Captures records instead of printing. Used by tests and by the worker's
 * in-process diagnostics panel. */
export class MemorySink implements LogSink {
  readonly records: LogRecord[] = [];
  write(record: LogRecord): void {
    this.records.push(record);
  }
  clear(): void {
    this.records.length = 0;
  }
}

export interface Logger {
  debug(message: string, context?: JsonObject): void;
  info(message: string, context?: JsonObject): void;
  warn(message: string, context?: JsonObject): void;
  error(message: string, context?: JsonObject): void;
  child(context: JsonObject): Logger;
}

export interface LoggerOptions {
  level?: LogLevel;
  sink?: LogSink;
  base?: JsonObject;
  now?: () => Date;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const sink = options.sink ?? consoleSink;
  const base = options.base ?? {};
  const now = options.now ?? (() => new Date());

  function emit(recordLevel: LogLevel, message: string, context: JsonObject = {}): void {
    if (LEVEL_ORDER[recordLevel] < LEVEL_ORDER[level]) return;
    sink.write({
      time: now().toISOString(),
      level: recordLevel,
      message,
      context: redact({ ...base, ...context }) as JsonObject,
    });
  }

  return {
    debug: (m, c) => emit("debug", m, c),
    info: (m, c) => emit("info", m, c),
    warn: (m, c) => emit("warn", m, c),
    error: (m, c) => emit("error", m, c),
    child: (context) =>
      createLogger({ ...options, level, sink, base: { ...base, ...context } }),
  };
}

export function errorContext(error: unknown): JsonObject {
  if (error instanceof Error) {
    const extra = (error as { toJSON?: () => JsonValue }).toJSON?.();
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(extra && typeof extra === "object" && !Array.isArray(extra) ? extra : {}),
    };
  }
  return { errorMessage: String(error) };
}
