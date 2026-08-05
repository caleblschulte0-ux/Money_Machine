import type { ReactNode } from "react";
import { STATUS_COLORS, type StatusTone } from "./tokens.ts";

/**
 * Shared UI primitives.
 *
 * The one opinionated component here is `Metric`: it takes `value: string |
 * null` and renders an explicit "not measured" state for null. Every number in
 * the command center comes from recorded events, and a metric with no evidence
 * must never render as a confident zero.
 */

export function Card({
  title,
  subtitle,
  children,
  actions,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-header">
          <div>
            {title && <h2 className="card-title">{title}</h2>}
            {subtitle && <p className="card-subtitle">{subtitle}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: StatusTone; children: ReactNode }) {
  const colors = STATUS_COLORS[tone];
  return (
    <span className="badge" style={{ color: colors.fg, background: colors.bg }}>
      {children}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  tone,
  unmeasuredReason = "Not measured",
}: {
  label: string;
  /** `null` means there is no evidence for this figure. */
  value: string | null;
  hint?: string;
  tone?: StatusTone;
  unmeasuredReason?: string;
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      {value === null ? (
        <span className="metric-value metric-unmeasured" title={unmeasuredReason}>
          {unmeasuredReason}
        </span>
      ) : (
        <span
          className="metric-value"
          style={tone ? { color: STATUS_COLORS[tone].fg } : undefined}
        >
          {value}
        </span>
      )}
      {hint && <span className="metric-hint">{hint}</span>}
    </div>
  );
}

export function MetricGrid({ children }: { children: ReactNode }) {
  return <div className="metric-grid">{children}</div>;
}

export function Table({
  headers,
  children,
  caption,
}: {
  headers: readonly string[];
  children: ReactNode;
  caption?: string;
}) {
  return (
    <div className="table-scroll">
      <table>
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      <p className="empty-description">{description}</p>
    </div>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: StatusTone;
  title: string;
  children?: ReactNode;
}) {
  const colors = STATUS_COLORS[tone];
  return (
    <div className="callout" style={{ borderLeftColor: colors.fg, background: colors.bg }}>
      <strong style={{ color: colors.fg }}>{title}</strong>
      {children && <div className="callout-body">{children}</div>}
    </div>
  );
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <p className="disclaimer">{children}</p>;
}

export function DefinitionList({
  items,
}: {
  items: readonly { term: string; description: ReactNode }[];
}) {
  return (
    <dl className="definition-list">
      {items.map((item) => (
        <div key={item.term} className="definition-row">
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
