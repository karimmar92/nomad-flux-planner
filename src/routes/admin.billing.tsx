/**
 * Internal billing admin: search, webhook history, reconciliation.
 *
 * THIS PAGE IS NOT THE SECURITY BOUNDARY. Every server function it calls
 * checks the admin role itself. The page renders for anyone who visits; it
 * simply shows nothing, because every call comes back Forbidden. That is the
 * correct arrangement — a route guard in React is a convenience, and treating
 * it as protection is how admin tools get exploited by people who read the
 * JavaScript bundle.
 *
 * DESIGN: this is a tool for one person at 2am during an incident, not a
 * dashboard. So: no charts, no summary cards, no colour except where it means
 * something. Drift is the only thing highlighted, because drift is the only
 * thing that requires action.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Check, RefreshCw, Search } from "lucide-react";
import { APP_NAME } from "@/lib/app";
import {
  adminListWebhookEvents,
  adminReconcileEntitlement,
  adminSearchBilling,
  type BillingRow,
  type WebhookEventRow,
} from "@/lib/billing/admin-billing.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/billing")({
  head: () => ({
    meta: [
      { title: `Billing admin | ${APP_NAME}` },
      // Belt and braces with robots.txt. Neither is protection; assertAdmin is.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminBilling,
});

function AdminBilling() {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<BillingRow[] | null>(null);
  const [events, setEvents] = useState<WebhookEventRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function run<T>(fn: () => Promise<T>, after: (r: T) => void) {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      after(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Billing admin</h1>
        <p className="text-sm text-muted-foreground">
          Stripe is the source of truth. This page shows where the app disagrees with it, and lets
          you make the app agree.
        </p>
      </div>

      {/* ── Search ─────────────────────────────────────────────────── */}
      <section className="panel space-y-3 p-4">
        <h2 className="text-sm font-semibold">Find an account</h2>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => adminSearchBilling({ data: { query } }),
              (r) => setRows(r.rows),
            );
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="email, user id, or cus_…"
            className="input max-w-sm"
          />
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            <Search className="h-4 w-4" aria-hidden />
            Search
          </button>
        </form>

        {error ? (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        ) : null}
        {note ? <p className="text-sm text-accent-positive">{note}</p> : null}

        {rows?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No account matched.</p>
        ) : null}

        {rows?.map((r) => (
          <div
            key={r.userId}
            className={cn(
              "rounded-md border p-3 text-sm",
              r.drift ? "border-accent-warning bg-accent-warning-muted" : "border-border",
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">{r.email ?? r.userId}</span>
              {r.drift ? (
                <span className="flex items-center gap-1 text-xs font-medium text-accent-warning">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                  App says {r.plan}, Stripe implies {r.expectedPlan}
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Check className="h-3.5 w-3.5 text-accent-positive" aria-hidden />
                  In sync
                </span>
              )}
            </div>

            <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
              <Row label="Plan in app" value={r.plan} />
              <Row label="Stripe subscription" value={r.stripeStatus ?? "none"} />
              <Row label="Founding spot" value={r.foundingNumber ? `#${r.foundingNumber}` : "no"} />
              <Row label="Stripe customer" value={r.stripeCustomerId ?? "none"} />
              <Row label="User id" value={r.userId} />
              <Row label="Price" value={r.stripePriceId ?? "none"} />
            </dl>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminReconcileEntitlement({ data: { userId: r.userId } }),
                    (res) => {
                      setNote(
                        res.changed
                          ? `Reconciled: ${res.before} → ${res.after}.`
                          : `Already correct (${res.before}). Nothing changed.`,
                      );
                      void run(
                        () => adminSearchBilling({ data: { query } }),
                        (s) => setRows(s.rows),
                      );
                    },
                  )
                }
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:bg-surface-2 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Reconcile entitlement
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => adminListWebhookEvents({ data: { userId: r.userId, limit: 50 } }),
                    (res) => setEvents(res.events),
                  )
                }
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:border-primary/50 hover:bg-surface-2 disabled:opacity-50"
              >
                Their webhook history
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* ── Webhook history ────────────────────────────────────────── */}
      <section className="panel space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Webhook events</h2>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminListWebhookEvents({ data: { limit: 50 } }),
                  (r) => setEvents(r.events),
                )
              }
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              Recent
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void run(
                  () => adminListWebhookEvents({ data: { status: "error", limit: 50 } }),
                  (r) => setEvents(r.events),
                )
              }
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              Errors only
            </button>
          </div>
        </div>

        {events == null ? (
          <p className="text-sm text-muted-foreground">
            Nothing loaded. Events appear here once the webhook has fired at least once.
          </p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events matched.</p>
        ) : (
          <div className="hide-scrollbar overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 pe-3 font-medium">When</th>
                  <th className="py-1 pe-3 font-medium">Type</th>
                  <th className="py-1 pe-3 font-medium">Status</th>
                  <th className="py-1 pe-3 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} className="border-t border-border align-top">
                    <td className="py-1.5 pe-3 whitespace-nowrap text-muted-foreground">
                      {e.received_at.slice(0, 19).replace("T", " ")}
                    </td>
                    <td className="py-1.5 pe-3 font-medium">{e.type}</td>
                    <td
                      className={cn(
                        "py-1.5 pe-3",
                        e.status === "error" && "font-medium text-negative",
                        e.status === "skipped" && "text-muted-foreground",
                      )}
                    >
                      {e.status}
                    </td>
                    <td className="py-1.5 pe-3 text-muted-foreground">
                      {e.error ?? e.result ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Reconciliation only ever writes the plan field, and only to whatever Stripe already implies.
        It cannot grant a founding spot, issue a refund, or change anything in Stripe. Every run is
        written to the event log above, including the ones that changed nothing.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="shrink-0">{label}:</dt>
      <dd className="truncate font-medium text-foreground">{value}</dd>
    </div>
  );
}
