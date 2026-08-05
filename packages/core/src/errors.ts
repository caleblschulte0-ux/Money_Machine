export type ErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "budget_exceeded"
  | "approval_required"
  | "policy_violation"
  | "provider_unavailable"
  | "provider_disabled"
  | "rate_limited"
  | "timeout"
  | "kill_switch_engaged"
  | "not_implemented"
  | "internal";

/** Whether retrying the same call could plausibly succeed. */
const RETRYABLE: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
  "provider_unavailable",
  "rate_limited",
  "timeout",
  "internal",
]);

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown>;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    options: { cause?: unknown; retryable?: boolean } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.details = details;
    this.retryable = options.retryable ?? RETRYABLE.has(code);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export const errors = {
  unauthenticated: (message = "Authentication required") =>
    new AppError("unauthenticated", message),
  forbidden: (message: string, details?: Record<string, unknown>) =>
    new AppError("forbidden", message, details),
  notFound: (entity: string, id?: string) =>
    new AppError("not_found", `${entity} not found`, id ? { id } : {}),
  conflict: (message: string, details?: Record<string, unknown>) =>
    new AppError("conflict", message, details),
  validation: (message: string, details?: Record<string, unknown>) =>
    new AppError("validation_failed", message, details),
  budgetExceeded: (message: string, details?: Record<string, unknown>) =>
    new AppError("budget_exceeded", message, details),
  approvalRequired: (message: string, details?: Record<string, unknown>) =>
    new AppError("approval_required", message, details),
  policyViolation: (message: string, details?: Record<string, unknown>) =>
    new AppError("policy_violation", message, details),
  providerDisabled: (message: string, details?: Record<string, unknown>) =>
    new AppError("provider_disabled", message, details),
  killSwitch: (message: string, details?: Record<string, unknown>) =>
    new AppError("kill_switch_engaged", message, details),
  notImplemented: (what: string) =>
    new AppError("not_implemented", `${what} is not implemented yet`),
  timeout: (message: string, details?: Record<string, unknown>) =>
    new AppError("timeout", message, details),
} as const;

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  if (value instanceof Error) {
    return new AppError("internal", value.message, {}, { cause: value });
  }
  return new AppError("internal", String(value));
}
