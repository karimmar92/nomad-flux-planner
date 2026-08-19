import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { APP_NAME } from "@/lib/app";
import { useSession } from "@/lib/use-session";
import { listFunnelEvents } from "@/lib/admin/admin.functions";
import { GATE_COPY_EXPERIMENT } from "@/lib/analytics/experiment";

export const Route = createFileRoute("/admin/funnel")({
  head: () => ({
    meta: [
      { title: `Funnel debug | ${APP_NAME}` },
      { name: "description", content: "Raw paywall and trial funnel events with payloads." },
      { property: "og:title", content: `Funnel debug | ${APP_NAME}` },
      { property: "og:description", content: "Internal event inspector for the upgrade funnel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminFunnelPage,
});

/** The fields every funnel event is supposed to carry. Missing ones are flagged. */
const EXPECTED = ["route", "variant", "experiment"] as const;

function AdminFunnelPage() {
  const { signedIn, ready } = useSession();
  const fetchEvents = useServerFn(listFunnelEvents);
  const [event, setEvent] = useState("all");

  const { data, error, isLoading } = useQuery({
    queryKey: ["admin-funnel"],
    queryFn: () => fetchEvents({ data: { limit: 300 } }),
    enabled: signedIn,
    retry: false,
    refetchInterval: 15_000,
  });

  const kinds = useMemo(
    () => Array.from(new Set((data ?? []).map((r) => r.event))).sort(),
    [data],
  );
  const rows = useMemo(
    () => (data ?? []).filter((r) => event === "all" || r.event === event),
    [data, event],
  );

  /** Variant split, so the A/B test can be read without leaving the page. */
  const split = useMemo(() => {
    const m = new Map<string, { seen: number; trials: number }>();
    for (const r of data ?? []) {
      const v = String(r.props?.["variant"] ?? "—");
      const cur = m.get(v) ?? { seen: 0, trials: 0 };
      cur.seen += 1;
      if (r.event === "trial_start") cur.trials += 1;
      m.set(v, cur);
    }
    return [...m.entries()].sort();
  }, [data]);

  if (!ready) return null;
  if (!signedIn || error)
    return (
      <p className="panel p-4 text-sm text-muted-foreground">
        This page is restricted to administrators.
      </p>
    );
  if (isLoading || !data) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Funnel debug</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The last 300 events exactly as stored, refreshed every 15 seconds. A row is flagged
          when it is missing a field the funnel should always attach.
        </p>
      </header>

      <div className="panel flex flex-wrap items-center gap-3 p-3 text-xs">
        <span className="label-xs">Experiment {GATE_COPY_EXPERIMENT}</span>
        {split.map(([v, s]) => (
          <span key={v} className="rounded-md bg-surface-2 px-2 py-1">
            variant <span className="font-medium">{v}</span>: {s.seen} events, {s.trials} trial
            start{s.trials === 1 ? "" : "s"}
          </span>
        ))}
        <select
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          className="ms-auto rounded-md border border-input bg-surface px-2 py-1.5 text-sm"
        >
          <option value="all">All events</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const missing = EXPECTED.filter((k) => r.props?.[k] == null);
          return (
            <li key={r.id} className="panel p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.event}</span>
                <span className="text-muted-foreground">
                  {new Date(r.created_at).toISOString().slice(0, 19).replace("T", " ")}
                </span>
                {r.feature ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5">{r.feature}</span>
                ) : null}
                {r.reason ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5">{r.reason}</span>
                ) : null}
                <span className="rounded bg-surface-2 px-1.5 py-0.5">plan {r.plan ?? "—"}</span>
                <span className="rounded bg-surface-2 px-1.5 py-0.5">
                  checks left {r.checks_left ?? "—"}
                </span>
                {missing.length > 0 ? (
                  <span className="rounded bg-warning/15 px-1.5 py-0.5 text-warning-foreground">
                    missing: {missing.join(", ")}
                  </span>
                ) : null}
              </div>
              <pre className="mt-2 overflow-x-auto rounded-md bg-surface-2 p-2 leading-relaxed">
                {JSON.stringify(r.props ?? {}, null, 2)}
              </pre>
            </li>
          );
        })}
      </ul>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No events recorded yet.</p>
      ) : null}
    </div>
  );
}
