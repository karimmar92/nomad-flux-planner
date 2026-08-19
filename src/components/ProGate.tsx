import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOUNDING_PRICE_USD } from "@/config/founding";
import type { Gate } from "@/lib/paywall/use-gate";

/**
 * Two ways out of every gate, not one.
 *
 * A single "See Pro" button hides the fact that there is a one-off option, and
 * people who will not start a subscription frequently will pay once. The
 * subscription stays the primary button; the lifetime offer is a quiet second
 * line so the pair does not read as two competing pitches.
 */
function UpgradeActions({ cta, gate }: { cta: string; gate?: Gate | undefined }) {
  /*
    THE TRIGGER IS THE CLICK.

    When a gate is supplied the button no longer navigates to /pricing: it
    either spends one of the free monthly checks (soft gate) or opens the
    paywall sheet right here, at the moment of intent. Sending someone to a
    price table to answer "what does this do" is backwards — the sheet shows
    the outcome first and the price once.

    Without a gate (marketing surfaces, older call sites) the old links stand.
  */
  if (gate) {
    return (
      <div className="flex shrink-0 flex-col items-end gap-1">
        <button
          type="button"
          onClick={gate.request}
          className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          {gate.metered ? "Unlock this" : cta}
        </button>
        {gate.metered ? (
          <span className="text-[11px] text-muted-foreground">
            {gate.checksLeft} free {gate.checksLeft === 1 ? "check" : "checks"} left this month
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Link
        to="/pricing"
        search={{ plan: "pro" as const, interval: "annual" as const }}
        className="inline-flex min-h-9 items-center rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground"
      >
        {cta}
      </Link>
      <Link
        to="/pricing"
        hash="founding"
        className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        or ${FOUNDING_PRICE_USD} once — Founder 100
      </Link>
    </div>
  );
}

/**
 * Upgrade prompts live at the point of need — never as an interstitial.
 *
 * The rule: show the SHAPE of the answer. The real headline stays legible
 * ("3 exit options found · cheapest is Belgrade") and only the detail is
 * obscured. Proving the feature works converts far better than a wall.
 */
export function LockedPreview({
  headline,
  detail,
  cta = "See Pro",
  gate,
  children,
  className,
}: {
  /** The real, computed answer — must never be fake or blurred. */
  headline: string;
  detail: string;
  cta?: string;
  /** Supply to trigger the paywall in place instead of linking to /pricing. */
  gate?: Gate;
  /** The full answer, rendered blurred and inert behind the prompt. */
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      <div
        aria-hidden
        inert
        className="pointer-events-none select-none blur-[6px] saturate-[0.6] opacity-70"
      >
        {children}
      </div>

      <div className="absolute inset-0 bg-gradient-to-b from-surface/40 via-surface/80 to-surface" />

      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-border bg-surface-2 p-3 shadow-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-snug">{headline}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
          <UpgradeActions cta={cta} gate={gate} />
        </div>
      </div>
    </div>
  );
}

/** Inline prompt for places with no answer-shape to show (empty states). */
export function ProPrompt({
  title,
  body,
  cta = "See Pro",
  gate,
}: {
  title: string;
  body: string;
  cta?: string;
  gate?: Gate;
}) {
  return (
    <div className="panel flex items-start gap-2.5 p-4">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
      </div>
      <UpgradeActions cta={cta} gate={gate} />
    </div>
  );
}

export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary",
        className,
      )}
    >
      Pro
    </span>
  );
}

/** Shown when a gate is deliberately lifted because the user is in trouble. */
export function EmergencyUnlockNote({ children }: { children?: ReactNode }) {
  return (
    <p className="mt-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
      {children ??
        "The full ranked list is normally Pro. You are close to a deadline, so it is unlocked — sort the border first, decide about Pro later."}
    </p>
  );
}
