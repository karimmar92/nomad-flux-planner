/**
 * The product, shown under the hero of /business.
 *
 * A landing page for a dashboard usually puts a picture of one under the
 * headline. A picture goes stale the first time the dashboard changes and can
 * show anything. This renders the real thing: the same verdict, confidence and
 * action-list functions the dashboard runs, fed the labelled sample organisation
 * from lib/org/sample.ts. If the product changes, so does this, and every number
 * on it is one the product would actually produce.
 *
 * It is static by design (no buttons that go nowhere) and says plainly that the
 * people are made up.
 */
import { useMemo } from "react";
import { buildActionItems, type ActionItem } from "@/lib/org/actions";
import { recordConfidence } from "@/lib/org/confidence";
import { buildOrgOverview } from "@/lib/org/presence";
import { sampleDashboard } from "@/lib/org/sample";
import { buildVerdict } from "@/lib/org/verdict";
import { todayIso } from "@/lib/trip-dates";
import { cn } from "@/lib/utils";

const DOT: Record<ActionItem["severity"], string> = {
  urgent: "bg-negative",
  soon: "bg-warning",
  housekeeping: "bg-muted-foreground/50",
};

export function DashboardPreview({ className }: { className?: string }) {
  const model = useMemo(() => {
    const today = todayIso();
    const s = sampleDashboard(today);
    const overview = buildOrgOverview(s.rows, s.members, s.policies, today);
    const actions = buildActionItems(overview, s.rows, s.requests, today, { forecast: true });
    const confidence = recordConfidence(s.rows, s.members, today);
    const verdict = buildVerdict(overview, actions, confidence, true);
    return { overview, actions, confidence, verdict };
  }, []);

  const { overview, actions, confidence, verdict } = model;
  const quality = confidence.quality;

  return (
    <figure className={cn("mx-auto w-full max-w-4xl", className)}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-40px_rgba(0,0,0,0.35)]">
        {/* Window bar */}
        <div className="flex items-center gap-1.5 border-b border-border bg-surface-2 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" aria-hidden />
          <span className="ms-3 text-[11px] text-muted-foreground">Northwind Labs · Overview</span>
          <span className="ms-auto rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            Sample data
          </span>
        </div>

        <div className="grid gap-4 p-4 text-start sm:p-5 md:grid-cols-[1.2fr_1fr]">
          {/* Verdict */}
          <div className="rounded-xl border border-negative/40 p-4">
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-negative" aria-hidden />
              Act
            </p>
            <p className="mt-2 text-lg font-semibold leading-tight tracking-tight">
              {verdict.headline}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{verdict.detail}</p>

            <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3">
              {[
                ["Over", overview.counts.over],
                ["Approaching", overview.counts.approaching],
                ["Clear", overview.counts.clear],
                ["No data", overview.counts.noData],
              ].map(([label, n]) => (
                <div key={label as string}>
                  <p className="num text-lg font-semibold">{n}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Record confidence */}
          <div className="rounded-xl border border-border p-4">
            <p className="label-xs">Record confidence</p>
            <p className="num mt-1 text-3xl font-semibold">
              {quality === null ? "n/a" : `${quality}%`}
            </p>
            <div
              role="meter"
              aria-label="Record confidence"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={quality ?? 0}
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
            >
              <div
                className="h-full rounded-full bg-accent-positive"
                style={{ width: `${quality ?? 0}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
              {confidence.coverage}% of seats have logged travel. Scored from how complete and
              recent each record is.
            </p>
          </div>

          {/* Needs attention */}
          <div className="md:col-span-2">
            <p className="mb-2 text-xs font-semibold">Needs attention</p>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {actions.slice(0, 4).map((a) => (
                <li key={a.id} className="flex items-start gap-3 p-3">
                  <span
                    className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[a.severity])}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug">{a.title}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {a.detail}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                    {a.tab}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Rendered by the product&rsquo;s own engine from a made-up team of five. Country and dates
        only.
      </figcaption>
    </figure>
  );
}
