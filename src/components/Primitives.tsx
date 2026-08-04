import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  size = "md",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "negative" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div className="label-xs">{label}</div>
      <div
        className={cn(
          "num font-semibold",
          size === "sm" && "text-lg",
          size === "md" && "text-2xl",
          size === "lg" && "text-3xl sm:text-4xl",
          tone === "positive" && "text-positive",
          tone === "negative" && "text-negative",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

export function ScoreBar({
  label,
  value,
  max = 10,
  display,
}: {
  label: string;
  value: number;
  max?: number;
  display?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-foreground">{label}</span>
        <span className="num text-sm font-medium text-muted-foreground">
          {display ?? value.toFixed(1)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center gap-2 px-6 py-12 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function ConfidenceBadge({ confidence }: { confidence: "high" | "medium" | "low" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
        confidence === "high" && "border-positive/40 bg-positive-muted text-positive",
        confidence === "medium" && "border-border bg-surface-2 text-muted-foreground",
        confidence === "low" && "border-negative/40 bg-negative-muted text-negative",
      )}
    >
      {confidence} confidence
    </span>
  );
}
