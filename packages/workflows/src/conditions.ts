import { getPath, type JsonObject, type JsonValue } from "@holdco/core";

/**
 * Declarative conditions.
 *
 * Conditions are data, never code: they are stored with the workflow version,
 * shown to a human in the command center, and evaluated identically in dry-run
 * and live mode. No `eval`, no template language, no arbitrary predicates —
 * a workflow definition must be reviewable by someone who does not read
 * TypeScript.
 */
export type Comparison =
  | { op: "equals"; path: string; value: JsonValue }
  | { op: "not_equals"; path: string; value: JsonValue }
  | { op: "exists"; path: string }
  | { op: "missing"; path: string }
  | { op: "gt"; path: string; value: number }
  | { op: "gte"; path: string; value: number }
  | { op: "lt"; path: string; value: number }
  | { op: "lte"; path: string; value: number }
  | { op: "contains"; path: string; value: string }
  | { op: "in"; path: string; value: readonly JsonValue[] }
  | { op: "matches"; path: string; value: string };

export type Condition =
  | Comparison
  | { op: "all"; conditions: readonly Condition[] }
  | { op: "any"; conditions: readonly Condition[] }
  | { op: "not"; condition: Condition };

export interface ConditionResult {
  readonly passed: boolean;
  /** Human-readable trace, recorded on the step run so a decision is explainable. */
  readonly trace: readonly string[];
}

function describe(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  return JSON.stringify(value);
}

function evaluateComparison(condition: Comparison, context: JsonObject): ConditionResult {
  const actual = getPath(context, condition.path);
  let passed: boolean;

  switch (condition.op) {
    case "equals":
      passed = JSON.stringify(actual) === JSON.stringify(condition.value);
      break;
    case "not_equals":
      passed = JSON.stringify(actual) !== JSON.stringify(condition.value);
      break;
    case "exists":
      passed = actual !== undefined && actual !== null && actual !== "";
      break;
    case "missing":
      passed = actual === undefined || actual === null || actual === "";
      break;
    case "gt":
      passed = typeof actual === "number" && actual > condition.value;
      break;
    case "gte":
      passed = typeof actual === "number" && actual >= condition.value;
      break;
    case "lt":
      passed = typeof actual === "number" && actual < condition.value;
      break;
    case "lte":
      passed = typeof actual === "number" && actual <= condition.value;
      break;
    case "contains":
      passed =
        typeof actual === "string"
          ? actual.toLowerCase().includes(condition.value.toLowerCase())
          : Array.isArray(actual)
            ? actual.some((v) => JSON.stringify(v) === JSON.stringify(condition.value))
            : false;
      break;
    case "in":
      passed = condition.value.some((v) => JSON.stringify(v) === JSON.stringify(actual));
      break;
    case "matches":
      passed = typeof actual === "string" ? new RegExp(condition.value, "i").test(actual) : false;
      break;
  }

  const valuePart = "value" in condition ? ` ${describe(condition.value)}` : "";
  return {
    passed,
    trace: [
      `${condition.path} (${describe(actual)}) ${condition.op}${valuePart} → ${passed ? "pass" : "fail"}`,
    ],
  };
}

export function evaluateCondition(condition: Condition, context: JsonObject): ConditionResult {
  switch (condition.op) {
    case "all": {
      const results = condition.conditions.map((c) => evaluateCondition(c, context));
      const passed = results.every((r) => r.passed);
      return {
        passed,
        trace: [`all(${condition.conditions.length}) → ${passed ? "pass" : "fail"}`,
          ...results.flatMap((r) => r.trace.map((t) => `  ${t}`))],
      };
    }
    case "any": {
      const results = condition.conditions.map((c) => evaluateCondition(c, context));
      const passed = results.some((r) => r.passed);
      return {
        passed,
        trace: [`any(${condition.conditions.length}) → ${passed ? "pass" : "fail"}`,
          ...results.flatMap((r) => r.trace.map((t) => `  ${t}`))],
      };
    }
    case "not": {
      const inner = evaluateCondition(condition.condition, context);
      return {
        passed: !inner.passed,
        trace: [`not → ${!inner.passed ? "pass" : "fail"}`, ...inner.trace.map((t) => `  ${t}`)],
      };
    }
    default:
      return evaluateComparison(condition, context);
  }
}

/**
 * Resolve `{{path}}` references in an action's input against the run context.
 * Substitution only — no expressions, no function calls.
 */
export function resolveTemplate(input: JsonValue, context: JsonObject): JsonValue {
  if (typeof input === "string") {
    const whole = input.match(/^\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}$/);
    if (whole) {
      const value = getPath(context, whole[1]!);
      return value === undefined ? null : value;
    }
    return input.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_m, path: string) => {
      const value = getPath(context, path);
      return value === undefined || value === null ? "" : String(value);
    });
  }
  if (Array.isArray(input)) return input.map((v) => resolveTemplate(v, context));
  if (input && typeof input === "object") {
    return Object.fromEntries(
      Object.entries(input).map(([k, v]) => [k, resolveTemplate(v as JsonValue, context)]),
    ) as JsonObject;
  }
  return input;
}
