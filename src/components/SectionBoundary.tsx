/**
 * A crash containment wall for a single section of a page.
 *
 * ── WHY ───────────────────────────────────────────────────────────────
 *
 * The profile page hosts the billing card and the post-checkout receipt. Those
 * two read remote state that can be missing, stale or malformed the moment
 * after a payment. Without a boundary, one bad field in one card unmounts the
 * entire route and the buyer, who has just paid, sees a blank screen. That is
 * the worst possible moment for it.
 *
 * So each risky section gets its own boundary: the rest of the page survives,
 * the failing card says what happened, and the buyer is told plainly that the
 * payment is not at risk and where to go if it is. Never a bare stack trace,
 * and never silence.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ErrorCard({
  title,
  body,
  detail,
  onRetry,
}: {
  title: string;
  body: string;
  /** The raw message. Shown small: useful in a support email, ignorable otherwise. */
  detail?: string | undefined;
  onRetry?: (() => void) | undefined;
}) {
  return (
    <section className="panel space-y-3 border-negative/40 p-4" role="alert">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-negative" aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
          {detail ? (
            <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground/80">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Try again
          </button>
        ) : null}
        <Link
          to="/legal/imprint"
          className="inline-flex min-h-9 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-surface-2"
        >
          Contact support
        </Link>

      </div>
    </section>
  );
}

type Props = {
  children: ReactNode;
  title?: string;
  body?: string;
};

export class SectionBoundary extends Component<Props, { error: Error | null }> {
  override state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Kept: this is the only trace of the failure that reaches a console log.
    console.error("[SectionBoundary]", error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <ErrorCard
        title={this.props.title ?? "This section could not be shown"}
        body={
          this.props.body ??
          "Something on this card failed to load. Nothing was lost, and any payment you made is unaffected — it is recorded with our payment provider either way."
        }
        detail={error.message}
        onRetry={() => this.setState({ error: null })}
      />
    );
  }
}
